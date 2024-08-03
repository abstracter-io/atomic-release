import { vitest } from "vitest";
import { ChildProcess } from "node:child_process";

import { SDK } from "../src/index.js";

type StrategyStubConfig = SDK.StrategyConfig & {
  test: number;
};

class CommandA extends SDK.Command {
  do(): Promise<void> {
    return Promise.resolve();
  }
}

class CommandB extends SDK.Command {
  do(): Promise<void> {
    return Promise.resolve();
  }
}

class LoggerStub implements SDK.Logger {
  info = vitest.fn();
  warn = vitest.fn();
  error = vitest.fn();
  debug = vitest.fn();
}

class NoopLogger implements SDK.Logger {
  public static INSTANCE = new NoopLogger();

  info = () => {};
  warn = () => {};
  error = () => {};
  debug = () => {};
}

class ReleaseStub implements SDK.Release {
  listVersions = vitest.fn();
  getChangelog = vitest.fn();
  getNextVersion = vitest.fn();
  getMentionedIssues = vitest.fn();
  getPreviousVersion = vitest.fn();
  getChangelogByVersion = vitest.fn();
}

class StrategyStub extends SDK.Strategy<StrategyStubConfig> {
  public constructor(config: StrategyStubConfig) {
    super(config);
  }
}

class GitClientStub extends SDK.GitExecClient {
  constructor() {
    super({ workingDirectory: process.cwd() });
  }

  log = vitest.fn();
  refHash = vitest.fn();
  refName = vitest.fn();
  commits = vitest.fn();
  cliVersion = vitest.fn();
  mergedTags = vitest.fn();
  remoteTagHash = vitest.fn();
  remoteBranchHash = vitest.fn();
}

export const Stubs = {
  CommandA,
  CommandB,
  LoggerStub,
  NoopLogger,
  ReleaseStub,
  StrategyStub,
  GitClientStub,

  childProcess() {
    const childProcess = new ChildProcess();

    // @ts-ignore
    childProcess.exitCode = 0;

    return childProcess;
  },
}
