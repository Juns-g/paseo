import { z } from "zod";
import type { PersistedConfig } from "../../persisted-config.js";
import type {
  StructuredTextGeneration,
  StructuredTextGenerationRequest,
} from "./git-metadata-generator.js";

export class StructuredTextGenerationError extends Error {
  constructor() {
    // Endpoint errors can contain credentials: expose only a fixed failure message.
    super("Lightweight metadata generation unavailable");
    this.name = "StructuredTextGenerationError";
  }
}

const OpenAIResponseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});
const GeminiResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({ parts: z.array(z.object({ text: z.string() })).min(1) }),
      }),
    )
    .min(1),
});

export class HttpStructuredTextGeneration implements StructuredTextGeneration {
  constructor(private readonly config?: PersistedConfig["inference"]) {}

  async generate<T>(request: StructuredTextGenerationRequest<T>): Promise<T> {
    if (!this.config) {
      throw new StructuredTextGenerationError();
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new StructuredTextGenerationError());
      }, 30_000);
    });
    try {
      return await Promise.race([this.complete(request, controller.signal), deadline]);
    } catch {
      throw new StructuredTextGenerationError();
    } finally {
      clearTimeout(timer);
    }
  }

  private async complete<T>(
    request: StructuredTextGenerationRequest<T>,
    signal: AbortSignal,
  ): Promise<T> {
    const config = this.config!;
    const schema = z.toJSONSchema(request.schema, { target: "draft-07", io: "input" });
    const prompt = request.prompt.slice(0, 24_000);
    const base = config.endpoint.replace(/\/+$/, "");
    let endpoint: string;
    let headers: Record<string, string>;
    let body: unknown;
    if (config.provider === "gemini") {
      endpoint = `${base}/models/${encodeURIComponent(config.model)}:generateContent`;
      headers = { "content-type": "application/json", "x-goog-api-key": config.apiKey };
      body = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          maxOutputTokens: 1024,
        },
      };
    } else {
      endpoint = `${base}/chat/completions`;
      headers = { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` };
      body = {
        model: config.model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_schema", json_schema: { name: request.schemaName, schema } },
        max_tokens: 1024,
        stream: false,
      };
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
      redirect: "error",
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new StructuredTextGenerationError();
    }
    const payload: unknown = await response.json();
    let content: string;
    if (config.provider === "gemini") {
      content = GeminiResponseSchema.parse(payload)
        .candidates[0]!.content.parts.map((part) => part.text)
        .join("");
    } else {
      content = OpenAIResponseSchema.parse(payload).choices[0]!.message.content;
    }
    return request.schema.parse(JSON.parse(content));
  }
}
