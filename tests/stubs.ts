import { vitest } from "vitest";

import { SDK } from "../src/index";

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

class ReleaseStub implements SDK.Release {
  getVersions = vitest.fn();
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

class GitClientStub extends SDK.GitExecaClient {
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

  ReleaseStub,
  StrategyStub,

  GitClientStub,
}
