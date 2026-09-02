import type { SessionConfigOption } from "@agentclientprotocol/sdk";
import type { AgentProviderModeDefinition } from "@getpaseo/protocol/provider-manifest";
import type { Logger } from "pino";

import type { AgentSessionConfig } from "../agent-sdk-types.js";
import type {
  ACPProviderModeWriterContext,
  ACPProviderModeWriteResult,
  ACPSessionLaunch,
  SessionStateResponse,
} from "./acp-agent.js";
import { GenericACPAgentClient } from "./generic-acp-agent.js";

export const OMP_ACP_DEFAULT_MODE_ID = "yolo" as const;
export const OMP_ACP_MODES: AgentProviderModeDefinition[] = [
  {
    id: "always-ask",
    label: "Ask Every Time",
    description: "Auto-approves read-only tools; asks before write and exec tools",
    icon: "ShieldCheck",
    colorTier: "safe",
  },
  {
    id: "write",
    label: "Write Access",
    description: "Auto-approves read and write tools; asks before exec tools",
    icon: "ShieldAlert",
    colorTier: "moderate",
  },
  {
    id: "yolo",
    label: "Full Access",
    description: "Auto-approves read, write, and exec tools",
    icon: "ShieldOff",
    colorTier: "dangerous",
    isUnattended: true,
  },
];

const OMP_ACP_MODE_IDS = new Set(OMP_ACP_MODES.map((mode) => mode.id));

export const OMP_ACP_MODE_RESTART_NOTICE = {
  type: "warning",
  message: "Start or restart the OMP session to apply the approval mode",
} as const;

export function buildOmpAcpSessionLaunch(
  config: AgentSessionConfig,
  launch: ACPSessionLaunch,
): ACPSessionLaunch {
  const modeId = config.modeId ?? OMP_ACP_DEFAULT_MODE_ID;
  if (!OMP_ACP_MODE_IDS.has(modeId)) {
    throw new Error(`Invalid OMP ACP approval mode '${modeId}'`);
  }

  const argsWithoutApprovalMode: string[] = [];
  for (let index = 0; index < launch.args.length; index += 1) {
    const arg = launch.args[index];
    if (arg === "--approval-mode") {
      index += 1;
      continue;
    }
    if (arg?.startsWith("--approval-mode=")) {
      continue;
    }
    if (arg !== undefined) {
      argsWithoutApprovalMode.push(arg);
    }
  }

  const acpIndex = argsWithoutApprovalMode.indexOf("acp");
  const insertAt = acpIndex >= 0 ? acpIndex : 0;
  return {
    command: launch.command,
    args: [
      ...argsWithoutApprovalMode.slice(0, insertAt),
      "--approval-mode",
      modeId,
      ...argsWithoutApprovalMode.slice(insertAt),
    ],
    modeId,
  };
}

export function transformOmpAcpSessionResponse(
  response: SessionStateResponse,
): SessionStateResponse {
  // OMP's ACP mode picker controls its default/plan UI. Approval mode is a
  // process setting, so this adapter exposes its own static modes instead.
  return { ...response, modes: null };
}

export function transformOmpAcpConfigOptions(
  configOptions: SessionConfigOption[],
): SessionConfigOption[] {
  return configOptions.filter((option) => option.category !== "mode" && option.id !== "mode");
}

export async function writeOmpAcpProviderMode(
  context: ACPProviderModeWriterContext,
): Promise<ACPProviderModeWriteResult> {
  if (!OMP_ACP_MODE_IDS.has(context.requestedModeId)) {
    throw new Error(`Invalid OMP ACP approval mode '${context.requestedModeId}'`);
  }

  const currentModeId = context.currentModeId ?? OMP_ACP_DEFAULT_MODE_ID;
  if (currentModeId === context.requestedModeId) {
    return { handled: true, currentModeId };
  }

  return {
    handled: true,
    currentModeId,
    notice: OMP_ACP_MODE_RESTART_NOTICE,
  };
}

interface OmpAcpAgentClientOptions {
  logger: Logger;
  command: [string, ...string[]];
  env?: Record<string, string>;
  providerId?: string;
  label?: string;
  providerParams?: unknown;
}

export class OmpAcpAgentClient extends GenericACPAgentClient {
  constructor(options: OmpAcpAgentClientOptions) {
    super({
      logger: options.logger,
      command: options.command,
      env: options.env,
      providerId: options.providerId ?? "omp-acp",
      label: options.label ?? "OMP ACP",
      providerParams: options.providerParams,
      defaultModes: OMP_ACP_MODES,
      includeAutoAcceptFeature: false,
      sessionLaunchTransformer: buildOmpAcpSessionLaunch,
      sessionResponseTransformer: transformOmpAcpSessionResponse,
      configOptionsTransformer: transformOmpAcpConfigOptions,
      modeIdTransformer: () => null,
      providerModeWriter: writeOmpAcpProviderMode,
    });
  }
}
