import { vitest, describe, test, expect } from 'vitest';

import { Stubs } from '../stubs.js';
import { GitCommitCommand, GitCommitCommandConfig } from '../../src/commands/index.js';

const LOGGER = new Stubs.LoggerStub();

const CMD_CONFIG: GitCommitCommandConfig = {
  logger: LOGGER,
  workingDirectory: '/bla/bla',
  commitMessage: 'There is no spoon',
  filePaths: new Set(['CHANGELOG.md', 'package.json']),
};

class GitCommitCommandStub extends GitCommitCommand {
  constructor(config?: Partial<GitCommitCommandConfig>) {
    super({
      ...CMD_CONFIG,
      ...config,
    });
  }

  public createChildProcess = vitest.fn(async (__args: any) => {
    return {
      stdout: '',
      stderr: '',
      childProcess: Stubs.childProcess(),
    };
  });
}

describe('perform a git commit', () => {
  test('invalid actor throws', async () => {
    const expectedError = new Error('actor must follow "name <email>" format');
    const commandStub = new GitCommitCommandStub({
      actor: '...',
    });

    await expect(commandStub.do()).rejects.toStrictEqual(expectedError);
  });

  test('undo removes last commit', async () => {
    const commandStub = new GitCommitCommandStub();

    await commandStub.do();

    await commandStub.undo();

    expect(commandStub.createChildProcess).toBeCalledWith('git reset HEAD~', {
      cwd: CMD_CONFIG.workingDirectory,

    });
  });

  test('files are staged & committed', async () => {
    const filePaths = Array.from(CMD_CONFIG.filePaths);
    const commandStub = new GitCommitCommandStub();

    await commandStub.do();

    for (const filePath of filePaths) {
      expect(LOGGER.info).toBeCalledWith(`Committed file ${filePath}`);
    }

    expect(commandStub.createChildProcess).toBeCalledWith(`git add ${filePaths.join(' ')}`, {
      cwd: CMD_CONFIG.workingDirectory,
    });

    expect(commandStub.createChildProcess).toBeCalledWith({ command: 'git', args: ['commit', '-m', CMD_CONFIG.commitMessage] }, {
      env: expect.any(Object),
      cwd: CMD_CONFIG.workingDirectory,
    });
  });

  test('actor is translated into git env vars', async () => {
    const name = 'Bot';
    const email = 'bot@email.com';
    const commandStub = new GitCommitCommandStub({
      actor: `${name} <${email}>`,
    });

    await commandStub.do();

    expect(commandStub.createChildProcess).toBeCalledWith({ command: 'git', args: ['commit', '-m', CMD_CONFIG.commitMessage] }, {
      env: expect.objectContaining({
        GIT_COMMITTER_NAME: name,
        GIT_COMMITTER_EMAIL: email,
        GIT_AUTHOR_NAME: name,
        GIT_AUTHOR_EMAIL: email,
      }),
      cwd: CMD_CONFIG.workingDirectory,
    });
  });
});
