const PASEO_NODE_ENV = "PASEO_NODE_ENV";

export interface NodeEntrypointSpec {
  entryPath: string;
  execArgv: string[];
}

export interface NodeEntrypointInvocation {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

export type NodeEntrypointArgvMode = "bare" | "node-script";

interface CreateNodeEntrypointInvocationInput {
  execPath: string;
  isPackaged: boolean;
  packagedRunnerPath: string | null;
  entrypoint: NodeEntrypointSpec;
  argvMode: NodeEntrypointArgvMode;
  args: string[];
  baseEnv: NodeJS.ProcessEnv;
}

export function createElectronNodeEnv(
  baseEnv: NodeJS.ProcessEnv,
  options?: { isPackaged?: boolean },
): NodeJS.ProcessEnv {
  return {
    ...baseEnv,
    // Node fetch does not use the login shell's proxies unless explicitly enabled.
    NODE_USE_ENV_PROXY: baseEnv.NODE_USE_ENV_PROXY ?? "1",
    NO_PROXY: baseEnv.NO_PROXY ?? baseEnv.no_proxy ?? "localhost,127.0.0.1,::1",
    ELECTRON_RUN_AS_NODE: "1",
    [PASEO_NODE_ENV]: options?.isPackaged === true ? "production" : "development",
  };
}

export function createNodeEntrypointInvocation(
  input: CreateNodeEntrypointInvocationInput,
): NodeEntrypointInvocation {
  const env = createElectronNodeEnv(input.baseEnv, { isPackaged: input.isPackaged });

  if (input.isPackaged) {
    if (!input.packagedRunnerPath) {
      throw new Error("Packaged node entrypoint runner is required for desktop launches.");
    }

    return {
      command: input.execPath,
      args: [
        "--disable-warning=DEP0040",
        input.packagedRunnerPath,
        input.argvMode,
        input.entrypoint.entryPath,
        ...input.args,
      ],
      env,
    };
  }

  return {
    command: input.execPath,
    args: [...input.entrypoint.execArgv, input.entrypoint.entryPath, ...input.args],
    env,
  };
}
