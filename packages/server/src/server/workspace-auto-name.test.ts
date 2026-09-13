import pino from "pino";
import { afterEach, expect, test, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  writePaseoWorktreeMetadata,
  writePaseoWorktreeFirstAgentBranchAutoNameMetadata,
} from "../utils/worktree-metadata.js";
import { createNoopWorkspaceGitService } from "./test-utils/workspace-git-service-stub.js";
import { WorkspaceAutoName } from "./workspace-auto-name.js";
import { createPersistedWorkspaceRecord, type WorkspaceRegistry } from "./workspace-registry.js";
import type { WorkspaceGitService } from "./workspace-git-service.js";

function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolve!: () => void;
  const promise = new Promise<void>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

test("auto-name preserves workspace archival that lands during its metadata write", async () => {
  let workspace = createPersistedWorkspaceRecord({
    workspaceId: "workspace-auto-name",
    projectId: "project-auto-name",
    cwd: "/workspace",
    kind: "directory",
    displayName: "workspace",
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:00:00.000Z",
  });
  const mutationStarted = deferred();
  const allowMutation = deferred();
  const updateEmitted = deferred();
  const workspaceRegistry = {
    update: async (_workspaceId, updater) => {
      mutationStarted.resolve();
      await allowMutation.promise;
      workspace = updater(workspace);
      return workspace;
    },
  } satisfies Pick<WorkspaceRegistry, "update">;
  const autoName = new WorkspaceAutoName({
    workspaceRegistry,
    workspaceGitService: {} as WorkspaceGitService,
    gitMutation: { notifyGitMutation: async () => {} },
    emitWorkspaceUpdateForCwd: async () => {},
    emitWorkspaceUpdateForWorkspaceId: async () => updateEmitted.resolve(),
    logger: pino({ level: "silent" }),
    generateWorkspaceName: async () => ({ title: "generated", branch: null }),
  });

  autoName.scheduleForDirectory({
    workspaceId: workspace.workspaceId,
    cwd: workspace.cwd,
    firstAgentContext: { prompt: "Name this workspace" },
  });
  await mutationStarted.promise;
  const archivedAt = "2026-08-08T00:01:00.000Z";
  workspace = { ...workspace, updatedAt: archivedAt, archivedAt };
  allowMutation.resolve();
  await updateEmitted.promise;

  expect(workspace).toMatchObject({
    title: "generated",
    archivedAt,
  });
});

const temporaryDirectories: string[] = [];
afterEach(() => {
  vi.useRealTimers();
  for (const cwd of temporaryDirectories.splice(0)) rmSync(cwd, { recursive: true, force: true });
});

test("failed generation for a pending worktree is attempted only once", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "paseo-auto-name-once-"));
  temporaryDirectories.push(cwd);
  execFileSync("git", ["init", "--initial-branch=placeholder-branch", cwd], { stdio: "pipe" });
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--allow-empty",
      "-m",
      "initial",
    ],
    { cwd, stdio: "pipe" },
  );
  writePaseoWorktreeMetadata(cwd, { baseRefName: "main" });
  writePaseoWorktreeFirstAgentBranchAutoNameMetadata(cwd, {
    placeholderBranchName: "placeholder-branch",
  });
  const workspace = createPersistedWorkspaceRecord({
    workspaceId: "once",
    projectId: "project",
    cwd,
    kind: "worktree",
    displayName: "placeholder-branch",
    branch: "placeholder-branch",
    worktreeRoot: cwd,
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:00:00.000Z",
  });
  const generateWorkspaceName = vi.fn<
    typeof import("./worktree-branch-name-generator.js").generateBranchNameFromFirstAgentContext
  >(async () => null);
  const autoName = new WorkspaceAutoName({
    workspaceRegistry: { update: async (_id, updater) => updater(workspace) },
    workspaceGitService: createNoopWorkspaceGitService(),
    gitMutation: { notifyGitMutation: async () => {} },
    emitWorkspaceUpdateForCwd: async () => {},
    emitWorkspaceUpdateForWorkspaceId: async () => {},
    logger: pino({ level: "silent" }),
    generateWorkspaceName,
  });
  autoName.scheduleForWorktree({ workspace, firstAgentContext: { prompt: "Fix login" } });
  await vi.waitFor(() => expect(generateWorkspaceName).toHaveBeenCalledTimes(1));
  expect(generateWorkspaceName).toHaveBeenCalledTimes(1);
  expect(generateWorkspaceName.mock.calls[0]?.[0]).toMatchObject({ includeBranch: true });
  expect(execFileSync("git", ["branch", "--show-current"], { cwd, encoding: "utf8" }).trim()).toBe(
    "placeholder-branch",
  );
});
