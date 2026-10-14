import { describe, expect, test, vi } from "vitest";
import type { AgentCapabilities, ClientSideConnection } from "@agentclientprotocol/sdk";
import { ACPAgentSession, buildACPClientCapabilities } from "./acp-agent.js";
import type { AgentStreamEvent } from "../agent-sdk-types.js";
import { asInternals } from "../../test-utils/class-mocks.js";
import { createTestLogger } from "../../../test-utils/test-logger.js";

function harness(negotiated = true) {
  const session = new ACPAgentSession(
    { provider: "hermes", cwd: "/tmp" },
    {
      provider: "hermes",
      logger: createTestLogger(),
      defaultCommand: ["unused"],
      defaultModes: [],
      capabilities: {
        supportsStreaming: true,
        supportsSessionPersistence: true,
        supportsDynamicModes: true,
        supportsMcpServers: true,
        supportsReasoningStream: true,
        supportsToolInvocations: true,
      },
    },
  );
  const internals = asInternals<{
    sessionId: string;
    agentCapabilities: AgentCapabilities;
    activeForegroundTurnId: string | null;
  }>(session);
  internals.sessionId = "owner";
  internals.agentCapabilities = negotiated ? { _meta: { hermes: { backgroundTurns: 1 } } } : {};
  const events: AgentStreamEvent[] = [];
  session.subscribe((event) => events.push(event));
  return { session, events, internals };
}

describe("Hermes ACP background turns", () => {
  test("advertises support while preserving caller metadata", () => {
    expect(buildACPClientCapabilities({ source: "test" })._meta).toMatchObject({
      source: "test",
      hermes: { backgroundTurns: 1 },
    });
  });

  test.each(["completed", "failed", "cancelled"] as const)(
    "maps %s with a distinct message and turn identity",
    async (status) => {
      const { session, events } = harness();
      const params = { sessionId: "owner", turnId: "background-1" };
      await session.extNotification("_hermes/background_turn", { ...params, status: "started" });
      await session.sessionUpdate({
        sessionId: "owner",
        update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "result" } },
      });
      await session.extNotification("_hermes/background_turn", {
        ...params,
        status,
        error: "model failed",
      });
      await session.extNotification("_hermes/background_turn", { ...params, status });
      expect(events.filter((event) => event.type === "turn_started")).toHaveLength(1);
      const message = events.find((event) => event.type === "timeline");
      expect(message?.turnId).toBe("background-1");
      const expected = {
        completed: "turn_completed",
        failed: "turn_failed",
        cancelled: "turn_canceled",
      }[status];
      expect(events.filter((event) => event.type === expected)).toHaveLength(1);
    },
  );

  test("ignores unnegotiated, foreign and invalid lifecycle signals", async () => {
    const { session, events } = harness(false);
    await session.extNotification("_hermes/background_turn", {
      sessionId: "owner",
      turnId: "b",
      status: "started",
    });
    expect(events.filter((event) => event.type === "turn_started")).toHaveLength(0);
    const enabled = harness();
    for (const params of [
      { sessionId: "foreign", turnId: "b", status: "started" },
      { sessionId: "owner", turnId: "", status: "started" },
      { sessionId: "owner", turnId: "b", status: "unknown" },
      { sessionId: "owner", turnId: "b", status: "completed" },
    ])
      await enabled.session.extNotification("_hermes/background_turn", params);
    expect(enabled.events.filter((event) => event.type.startsWith("turn_"))).toHaveLength(0);
  });

  test("background completion cannot finish a waiting user turn", async () => {
    const { session, events, internals } = harness();
    await session.extNotification("_hermes/background_turn", {
      sessionId: "owner",
      turnId: "background",
      status: "started",
    });
    internals.activeForegroundTurnId = "user";
    await session.sessionUpdate({
      sessionId: "owner",
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "background result" },
      },
    });
    await session.extNotification("_hermes/background_turn", {
      sessionId: "owner",
      turnId: "background",
      status: "completed",
    });
    expect(internals.activeForegroundTurnId).toBe("user");
    expect(
      events.filter((event) => event.type === "timeline").map((event) => event.turnId),
    ).toEqual(["background"]);
  });

  test("interrupt waits for the background cancellation acknowledgement", async () => {
    const { session, events } = harness();
    const cancel = vi.fn(async () => {});
    asInternals<{ connection: Pick<ClientSideConnection, "cancel"> }>(session).connection = {
      cancel,
    };
    await session.extNotification("_hermes/background_turn", {
      sessionId: "owner",
      turnId: "background",
      status: "started",
    });
    let settled = false;
    const interrupt = session.interrupt().then(() => {
      settled = true;
      return undefined;
    });
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledWith({ sessionId: "owner" }));
    expect(settled).toBe(false);
    await session.extNotification("_hermes/background_turn", {
      sessionId: "owner",
      turnId: "background",
      status: "cancelled",
    });
    await interrupt;
    expect(events.filter((event) => event.type === "turn_canceled")).toHaveLength(1);
  });
});
