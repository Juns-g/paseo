import { readPaseoConfigJson } from "./paseo-config-file.js";
import {
  PaseoConfigSchema,
  type PaseoMetadataGeneration,
} from "@getpaseo/protocol/paseo-config-schema";

export type MetadataConfigKey = "title" | "branchName" | "commitMessage" | "pullRequest";

export interface RepoRootResolver {
  resolveRepoRoot: (cwd: string) => Promise<string>;
}

// A style section carries the default guidance for one artifact. The project
// owner replaces it wholesale via paseo.json metadataGeneration.<configKey>.instructions
// — their text is used instead of the default, never appended alongside it, so the
// two never conflict. The contract block (what to produce, the JSON shape, and any
// correctness/safety rules) lives outside the sections and is never overridable.
export interface MetadataStyleSection {
  configKey: MetadataConfigKey;
  default: string;
  label?: string;
}

export interface BuildMetadataPromptOptions {
  cwd: string;
  contract: string;
  styles: MetadataStyleSection[];
  after: string;
  trailing?: string;
  workspaceGitService?: RepoRootResolver;
}

export async function buildMetadataPrompt(options: BuildMetadataPromptOptions): Promise<string> {
  const overrides = await readProjectMetadataOverrides(options);
  const styleBlocks = options.styles.map((section) =>
    renderStyleSection(section, overrides?.[section.configKey]?.instructions),
  );
  const head = [options.contract, ...styleBlocks, options.after].join("\n\n");
  const prompt = options.trailing ? `${head}\n\n${options.trailing}` : head;
  return prompt.slice(0, 24_000);
}

function renderStyleSection(section: MetadataStyleSection, override: string | undefined): string {
  const body = isNonEmptyString(override) ? override.trim().slice(0, 2_000) : section.default;
  return section.label ? `${section.label}:\n${body}` : body;
}

async function readProjectMetadataOverrides(
  options: Pick<BuildMetadataPromptOptions, "cwd" | "workspaceGitService">,
): Promise<PaseoMetadataGeneration | undefined> {
  let repoRoot = options.cwd;
  if (options.workspaceGitService) {
    try {
      repoRoot = await options.workspaceGitService.resolveRepoRoot(options.cwd);
    } catch {
      // Non-git directory workspaces keep their naming instructions in cwd.
    }
  }
  try {
    const json = readPaseoConfigJson(repoRoot);
    return PaseoConfigSchema.parse(json).metadataGeneration;
  } catch {
    return undefined;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}
