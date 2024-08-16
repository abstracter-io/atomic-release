import { vitest } from 'vitest';
import { ChildProcess } from 'node:child_process';

import { SDK } from '../src/index.js';

const conventionalCommit = () => {
  return {
    subject: 'feat: ...',
    body: 'test',
    notes: '',
    author: {
      name: '',
      email: '',
    },
    committer: {
      name: '',
      email: '',
    },
    tags: [],
    hash: Stubs.GitClientStub.HASH,
    committedTimestamp: 1633686020134,
  };
};

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
  public static readonly HASH = 'c658ea3e060490dced90dfb34c018d88b8e797f9';
  public static readonly STABLE_BRANCH_NAME = 'main';
  public static readonly PRE_RELEASE_BRANCH_NAME = 'beta';

  constructor() {
    super({ workingDirectory: process.cwd() });
  }

  refHash = vitest.fn(async () => {
    return GitClientStub.HASH;
  });

  refName = vitest.fn(async () => {
    return GitClientStub.PRE_RELEASE_BRANCH_NAME;
  });

  commits = vitest.fn(async (..._args: any[]) => {
    return [conventionalCommit()];
  });

  listTags = vitest.fn(async () => {
    const name = 'v0.1.0-beta.0';
    const hash = GitClientStub.HASH;

    return [{ name, hash }];
  });

  cliVersion = vitest.fn(async () => {
    return '2.7.0';
  });

  remoteTagHash = vitest.fn(async () => {
    return null;
  });

  remoteBranchHash = vitest.fn(async () => {
    return GitClientStub.HASH;
  });
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

    // @ts-expect-error override a process exit code
    childProcess.exitCode = 0;

    return childProcess;
  },

  conventionalCommit,

  async fixedDate<T>(date: Date, cb: (now: Date) => T) {
    vitest.useFakeTimers({ now: date });

    return Promise.resolve(cb(date)).finally(() => {
      vitest.useRealTimers();
    });
  },
};
