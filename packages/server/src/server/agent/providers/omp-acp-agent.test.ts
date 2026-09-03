import type { SessionConfigOption } from "@agentclientprotocol/sdk";
import { describe, expect, test, vi } from "vitest";

import { createTestLogger } from "../../../test-utils/test-logger.js";
import { asInternals } from "../../test-utils/class-mocks.js";
import type { AgentMode, AgentSessionConfig } from "../agent-sdk-types.js";
import {
  ACPAgentSession,
  type ACPProviderModeWriterContext,
  type SessionStateResponse,
} from "./acp-agent.js";
import {
  OMP_ACP_DEFAULT_MODE_ID,
  OMP_ACP_MODE_RESTART_NOTICE,
  OMP_ACP_MODES,
  OmpAcpAgentClient,
  buildOmpAcpSessionLaunch,
  transformOmpAcpConfigOptions,
  transformOmpAcpSessionResponse,
  writeOmpAcpProviderMode,
} from "./omp-acp-agent.js";

const baseConfig: AgentSessionConfig = {
  provider: "omp-acp",
  cwd: "/tmp/omp-acp-test",
};

function writerContext(
  requestedModeId: string,
  currentModeId: string | null,
): ACPProviderModeWriterContext {
  return {
    connection: null as never,
    sessionId: "session-1",
    requestedModeId,
    currentModeId,
    selection: null as never,
    configOptions: [],
    logger: null as never,
  };
}

interface LiveOmpAcpSessionInternals {
  sessionId: string | null;
  connection: {
    setSessionMode: (input: { sessionId: string; modeId: string }) => Promise<void>;
  };
  availableModes: AgentMode[];
  configOptions: SessionConfigOption[];
  currentMode: string | null;
  config: AgentSessionConfig;
}

describe("OMP ACP approval modes", () => {
  test("exposes OMP approval values and defaults to Ask Every Time", () => {
    expect(OMP_ACP_DEFAULT_MODE_ID).toBe("always-ask");
    expect(OMP_ACP_MODES).toEqual([
      expect.objectContaining({
        id: "always-ask",
        label: "Ask Every Time",
        colorTier: "safe",
      }),
      expect.objectContaining({ id: "write", label: "Write Access", colorTier: "moderate" }),
      expect.objectContaining({
        id: "yolo",
        label: "Full Access",
        colorTier: "dangerous",
        isUnattended: true,
      }),
    ]);
  });

  test.each(["always-ask", "write", "yolo"] as const)(
    "passes the selected %s value to the OMP process",
    (modeId) => {
      expect(
        buildOmpAcpSessionLaunch(
          { ...baseConfig, modeId },
          { command: "omp", args: ["--no-extensions", "acp"] },
        ),
      ).toEqual({
        command: "omp",
        args: ["--no-extensions", "--approval-mode", modeId, "acp"],
        modeId,
      });
    },
  );

  test("defaults to always-ask and replaces an existing CLI override", () => {
    expect(
      buildOmpAcpSessionLaunch(baseConfig, {
        command: "omp",
        args: ["--approval-mode=yolo", "--no-extensions", "acp"],
      }),
    ).toEqual({
      command: "omp",
      args: ["--no-extensions", "--approval-mode", "always-ask", "acp"],
      modeId: "always-ask",
    });
  });

  test("uses the persisted modeId when a session is resumed", () => {
    expect(
      buildOmpAcpSessionLaunch(
        { ...baseConfig, modeId: "write" },
        { command: "omp", args: ["--no-extensions", "acp"] },
      ),
    ).toMatchObject({
      args: ["--no-extensions", "--approval-mode", "write", "acp"],
      modeId: "write",
    });
  });

  test("hides OMP's unrelated ACP default and plan modes", () => {
    const response: SessionStateResponse = {
      sessionId: "session-1",
      modes: {
        availableModes: [
          { id: "default", name: "Default" },
          { id: "plan", name: "Plan" },
        ],
        currentModeId: "default",
      },
      configOptions: [
        {
          id: "mode",
          name: "Mode",
          category: "mode",
          type: "select",
          currentValue: "default",
          options: [{ value: "default", name: "Default" }],
        },
      ],
    };

    expect(transformOmpAcpSessionResponse(response).modes).toBeNull();
    expect(transformOmpAcpConfigOptions(response.configOptions ?? [])).toEqual([]);
  });

  test("does not expose the generic ACP Auto Accept feature", async () => {
    const client = new OmpAcpAgentClient({
      logger: createTestLogger(),
      command: ["omp", "--no-extensions", "acp"],
    });

    await expect(client.listFeatures(baseConfig)).resolves.toEqual([]);

    const session = new ACPAgentSession(baseConfig, {
      provider: "omp-acp",
      logger: createTestLogger(),
      defaultCommand: ["omp", "--no-extensions", "acp"],
      defaultModes: OMP_ACP_MODES,
      includeAutoAcceptFeature: false,
      capabilities: {
        supportsStreaming: true,
        supportsSessionPersistence: true,
        supportsDynamicModes: true,
        supportsMcpServers: true,
        supportsReasoningStream: true,
        supportsToolInvocations: true,
      },
    });
    expect(session.features).toEqual([]);
  });

  test("keeps a live session's current mode and reports the restart boundary", async () => {
    await expect(writeOmpAcpProviderMode(writerContext("write", "yolo"))).resolves.toEqual({
      handled: true,
      currentModeId: "yolo",
      notice: OMP_ACP_MODE_RESTART_NOTICE,
    });

    await expect(writeOmpAcpProviderMode(writerContext("yolo", "yolo"))).resolves.toEqual({
      handled: true,
      currentModeId: "yolo",
    });
  });

  test("routes live mode changes through the ACP notice boundary", async () => {
    const session = new ACPAgentSession(
      { ...baseConfig, modeId: "yolo" },
      {
        provider: "omp-acp",
        logger: createTestLogger(),
        defaultCommand: ["omp", "--no-extensions", "acp"],
        defaultModes: OMP_ACP_MODES,
        modeIdTransformer: () => null,
        providerModeWriter: writeOmpAcpProviderMode,
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
    const setSessionMode = vi.fn(async () => undefined);
    const internals = asInternals<LiveOmpAcpSessionInternals>(session);
    internals.sessionId = "session-1";
    internals.connection = { setSessionMode };
    internals.availableModes = OMP_ACP_MODES;
    internals.configOptions = [];
    internals.currentMode = "yolo";

    await expect(session.setMode("write")).resolves.toEqual(OMP_ACP_MODE_RESTART_NOTICE);
    expect(setSessionMode).not.toHaveBeenCalled();
    await expect(session.getCurrentMode()).resolves.toBe("yolo");
    expect(session.getConfiguredMode()).toBe("write");
    expect(internals.config.modeId).toBe("write");
  });

  test("rejects unknown approval values", async () => {
    expect(() =>
      buildOmpAcpSessionLaunch(
        { ...baseConfig, modeId: "plan" },
        { command: "omp", args: ["acp"] },
      ),
    ).toThrow("Invalid OMP ACP approval mode 'plan'");
    await expect(writeOmpAcpProviderMode(writerContext("plan", "yolo"))).rejects.toThrow(
      "Invalid OMP ACP approval mode 'plan'",
    );
  });
});
