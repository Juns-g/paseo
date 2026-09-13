import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  HttpStructuredTextGeneration,
  StructuredTextGenerationError,
} from "./http-structured-text-generation.js";

const config = {
  provider: "openai" as const,
  endpoint: "https://example.test/v1",
  model: "small",
  apiKey: "test-secret",
};
const request = {
  cwd: "/private/workspace",
  prompt: "Return a title as JSON",
  schema: z.object({ title: z.string().min(1) }),
  schemaName: "Title",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("HttpStructuredTextGeneration", () => {
  it("completes a real loopback HTTP request", async () => {
    const requests: Array<{
      method?: string;
      url?: string;
      authorization?: string;
      body: unknown;
    }> = [];
    const server = createServer(async (incoming, outgoing) => {
      let body = "";
      for await (const chunk of incoming) {
        body += chunk.toString();
      }
      requests.push({
        method: incoming.method,
        url: incoming.url,
        authorization: incoming.headers.authorization,
        body: JSON.parse(body),
      });
      outgoing.writeHead(200, { "content-type": "application/json" });
      outgoing.end(
        JSON.stringify({ choices: [{ message: { content: '{"title":"Real HTTP title"}' } }] }),
      );
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Missing test server address");
      const generation = new HttpStructuredTextGeneration({
        ...config,
        endpoint: `http://127.0.0.1:${address.port}/v1`,
      });
      await expect(generation.generate(request)).resolves.toEqual({ title: "Real HTTP title" });
      expect(requests).toEqual([
        {
          method: "POST",
          url: "/v1/chat/completions",
          authorization: "Bearer test-secret",
          body: {
            model: "small",
            messages: [{ role: "user", content: request.prompt }],
            response_format: {
              type: "json_schema",
              json_schema: { name: "Title", schema: expect.any(Object) },
            },
            max_tokens: 1024,
            stream: false,
          },
        },
      ]);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        }),
      );
    }
  });

  it("makes one stateless OpenAI-compatible request using only explicit credentials", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ choices: [{ message: { content: '{"title":"Fix login"}' } }] }),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await new HttpStructuredTextGeneration(config).generate(request)).toEqual({
      title: "Fix login",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://example.test/v1/chat/completions");
    expect(init.headers.authorization).toBe("Bearer test-secret");
    expect(init.redirect).toBe("error");
    expect(JSON.parse(init.body)).toEqual({
      model: "small",
      messages: [{ role: "user", content: request.prompt }],
      response_format: {
        type: "json_schema",
        json_schema: { name: "Title", schema: expect.any(Object) },
      },
      max_tokens: 1024,
      stream: false,
    });
    expect(init.body).not.toContain(request.cwd);
  });

  it("uses Gemini generateContent with its explicit API key", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        candidates: [{ content: { parts: [{ text: '{"title":"Gemini title"}' }] } }],
      }),
    );
    vi.stubGlobal("fetch", fetch);
    expect(
      await new HttpStructuredTextGeneration({
        ...config,
        provider: "gemini",
        endpoint: "https://example.test/v1beta",
      }).generate(request),
    ).toEqual({ title: "Gemini title" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://example.test/v1beta/models/small:generateContent");
    expect(init.headers["x-goog-api-key"]).toBe("test-secret");
    expect(JSON.parse(init.body)).toEqual({
      contents: [{ role: "user", parts: [{ text: request.prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: expect.any(Object),
        maxOutputTokens: 1024,
      },
    });
  });

  it("does not call any endpoint when unconfigured", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(new HttpStructuredTextGeneration().generate(request)).rejects.toBeInstanceOf(
      StructuredTextGenerationError,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    () => new Response("private-secret", { status: 429 }),
    () => new Response("not JSON"),
    () => Response.json({ choices: [] }),
    () => Response.json({ choices: [{ message: { content: "not JSON" } }] }),
    () => Response.json({ choices: [{ message: { content: '{"title":4}' } }] }),
  ])("rejects failures without retries or leaking provider output", async (response) => {
    const fetch = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", fetch);
    await expect(new HttpStructuredTextGeneration(config).generate(request)).rejects.toThrow(
      "Lightweight metadata generation unavailable",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each(["headers", "body"])(
    "enforces the 4-second deadline while waiting for %s",
    async (phase) => {
      vi.useFakeTimers();
      const pending = new Promise<never>(() => {});
      const fetch = vi
        .fn()
        .mockImplementation(() =>
          phase === "headers" ? pending : Promise.resolve({ ok: true, json: () => pending }),
        );
      vi.stubGlobal("fetch", fetch);
      const result = new HttpStructuredTextGeneration(config).generate(request);
      const rejection = expect(result).rejects.toBeInstanceOf(StructuredTextGenerationError);
      await vi.advanceTimersByTimeAsync(4_000);
      await rejection;
      expect(fetch.mock.calls[0]![1].signal.aborted).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it("bounds user-controlled prompt content", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ choices: [{ message: { content: '{"title":"Bounded"}' } }] }),
      );
    vi.stubGlobal("fetch", fetch);
    await new HttpStructuredTextGeneration(config).generate({
      ...request,
      prompt: "a".repeat(50_000),
    });
    expect(JSON.parse(fetch.mock.calls[0]![1].body).messages[0].content).toHaveLength(24_000);
  });
});
