import type pino from "pino";
import type { FirstAgentContext } from "@getpaseo/protocol/messages";

import { resolveFirstAgentPromptTitle } from "./agent/create-agent-title.js";
import type { StructuredTextGeneration } from "./session/checkout/git-metadata-generator.js";
import { HttpStructuredTextGeneration } from "./session/checkout/http-structured-text-generation.js";
import {
  attemptFirstAgentBranchAutoName,
  type AttemptFirstAgentBranchAutoNameResult,
} from "./paseo-worktree-service.js";
import type { GitMutationService } from "./session/git-mutation/git-mutation-service.js";
import type { WorkspaceGitService } from "./workspace-git-service.js";
import type { PersistedWorkspaceRecord, WorkspaceRegistry } from "./workspace-registry.js";
import {
  generateBranchNameFromFirstAgentContext,
  type GeneratedWorkspaceName,
} from "./worktree-branch-name-generator.js";

type WorkspaceNameGenerator = typeof generateBranchNameFromFirstAgentContext;

interface WorkspaceAutoNameOptions {
  generation?: StructuredTextGeneration;
  workspaceRegistry: Pick<WorkspaceRegistry, "update">;
  workspaceGitService: WorkspaceGitService;
  gitMutation: Pick<GitMutationService, "notifyGitMutation">;
  emitWorkspaceUpdateForCwd: (cwd: string) => Promise<void>;
  emitWorkspaceUpdateForWorkspaceId: (workspaceId: string) => Promise<void>;
  logger: pino.Logger;
  generateWorkspaceName?: WorkspaceNameGenerator;
}

export class WorkspaceAutoName {
  private readonly generation: StructuredTextGeneration;
  private readonly workspaceRegistry: Pick<WorkspaceRegistry, "update">;
  private readonly workspaceGitService: WorkspaceGitService;
  private readonly gitMutation: Pick<GitMutationService, "notifyGitMutation">;
  private readonly emitWorkspaceUpdateForCwd: (cwd: string) => Promise<void>;
  private readonly emitWorkspaceUpdateForWorkspaceId: (workspaceId: string) => Promise<void>;
  private readonly logger: pino.Logger;
  private readonly generateWorkspaceName: WorkspaceNameGenerator;

  constructor(options: WorkspaceAutoNameOptions) {
    this.generation = options.generation ?? new HttpStructuredTextGeneration();
    this.workspaceRegistry = options.workspaceRegistry;
    this.workspaceGitService = options.workspaceGitService;
    this.gitMutation = options.gitMutation;
    this.emitWorkspaceUpdateForCwd = options.emitWorkspaceUpdateForCwd;
    this.emitWorkspaceUpdateForWorkspaceId = options.emitWorkspaceUpdateForWorkspaceId;
    this.logger = options.logger;
    this.generateWorkspaceName =
      options.generateWorkspaceName ?? generateBranchNameFromFirstAgentContext;
  }

  scheduleForWorktree(input: {
    workspace: PersistedWorkspaceRecord;
    firstAgentContext: FirstAgentContext;
  }): void {
    this.schedule(
      () =>
        this.maybeAutoNameWorkspaceBranchForFirstAgent({
          ...input,
        }),
      {
        cwd: input.workspace.cwd,
        message: "Failed to auto-name worktree branch",
      },
    );
  }

  scheduleForDirectory(input: {
    workspaceId: string;
    cwd: string;
    firstAgentContext: FirstAgentContext;
  }): void {
    this.schedule(
      () =>
        this.maybeAutoNameDirectoryWorkspaceTitle({
          ...input,
        }),
      { cwd: input.cwd, message: "Failed to auto-name directory workspace title" },
    );
  }

  private async maybeAutoNameWorkspaceBranchForFirstAgent(input: {
    workspace: PersistedWorkspaceRecord;
    firstAgentContext: FirstAgentContext;
  }): Promise<void> {
    const worktreeRoot = input.workspace.worktreeRoot ?? input.workspace.cwd;
    let generated: GeneratedWorkspaceName | null = null;
    let generationAttempted = false;
    const result: AttemptFirstAgentBranchAutoNameResult = await attemptFirstAgentBranchAutoName({
      cwd: worktreeRoot,
      firstAgentContext: input.firstAgentContext,
      generateBranchNameFromContext: ({ firstAgentContext }) => {
        generationAttempted = true;
        return this.generateFromContext({
          cwd: input.workspace.cwd,
          firstAgentContext,
          includeBranch: true,
        }).then((nextGenerated) => {
          generated = nextGenerated;
          return nextGenerated?.branch ?? null;
        });
      },
    });

    if (!generationAttempted) {
      generated = await this.generateFromContext({
        cwd: input.workspace.cwd,
        firstAgentContext: input.firstAgentContext,
        includeBranch: false,
      });
    }
    const generatedTitle = generated?.title ?? null;
    if (!generatedTitle) {
      return;
    }

    // K4: re-read from the registry before writing so any concurrent upsert
    // that happened between workspace creation and this async path is not clobbered.
    // When the first-agent rename changed the git branch too, persist that branch
    // alongside the title — both are this path's own fields.
    await this.applyGeneratedWorkspaceTitle(input.workspace.workspaceId, {
      title: generatedTitle,
      ...(result.renamed ? { branch: result.branchName } : {}),
      promptTitle: resolveFirstAgentPromptTitle(input.firstAgentContext),
    });
    if (result.renamed) {
      await this.gitMutation.notifyGitMutation(worktreeRoot, "rename-branch");
    }
    await this.emitWorkspaceUpdateForCwd(input.workspace.cwd);
  }

  private async maybeAutoNameDirectoryWorkspaceTitle(input: {
    workspaceId: string;
    cwd: string;
    firstAgentContext: FirstAgentContext;
  }): Promise<void> {
    const generated = await this.generateFromContext({
      cwd: input.cwd,
      firstAgentContext: input.firstAgentContext,
      includeBranch: false,
    });
    const title = generated?.title ?? null;
    if (!title) {
      return;
    }
    // K4: applyGeneratedWorkspaceTitle re-reads from the registry before writing.
    // Directory workspaces have no branch — write only the title.
    await this.applyGeneratedWorkspaceTitle(input.workspaceId, {
      title,
      promptTitle: resolveFirstAgentPromptTitle(input.firstAgentContext),
    });
    await this.emitWorkspaceUpdateForWorkspaceId(input.workspaceId);
  }

  private async applyGeneratedWorkspaceTitle(
    workspaceId: string,
    input: { title: string; branch?: string | null; promptTitle?: string | null },
  ): Promise<void> {
    await this.workspaceRegistry.update(workspaceId, (current) => {
      let title = current.title;
      if (!title || (input.promptTitle && title === input.promptTitle)) {
        title = input.title;
      }
      return {
        ...current,
        title,
        ...(input.branch ? { branch: input.branch } : {}),
        updatedAt: new Date().toISOString(),
      };
    });
  }

  private generateFromContext(input: {
    cwd: string;
    firstAgentContext: FirstAgentContext;
    includeBranch: boolean;
  }): Promise<GeneratedWorkspaceName | null> {
    return this.generateWorkspaceName({
      generation: this.generation,
      includeBranch: input.includeBranch,
      cwd: input.cwd,
      workspaceGitService: this.workspaceGitService,
      firstAgentContext: input.firstAgentContext,
      logger: this.logger,
    });
  }

  private schedule(run: () => Promise<void>, context: { cwd: string; message: string }): void {
    setTimeout(() => {
      void run().catch((error) => {
        this.logger.warn({ err: error, cwd: context.cwd }, context.message);
      });
    }, 0);
  }
}
