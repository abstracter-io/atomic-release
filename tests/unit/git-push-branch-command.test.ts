import { ChildProcess } from 'node:child_process';
import { describe, test, expect, vitest } from 'vitest';

import { Stubs } from '../stubs';
import { Commands } from '../../src';

const CMD_CONFIG: Commands.GitPushBranchCommandConfig = {
  remote: 'custom-remote',
  logger: Stubs.NoopLogger.INSTANCE,
  workingDirectory: '/home/bla/bla',
  branchName: 'version-123-generated-files',
};

class GitPushBranchCommandStub extends Commands.GitPushBranchCommand {
  constructor(config?: Partial<Commands.GitPushBranchCommandConfig>) {
    super({ ...CMD_CONFIG, ...config });
  }

  public createChildProcess = vitest.fn((__args: any) => {
    const childProcess = new ChildProcess();

    return Promise.resolve({
      stdout: '',
      stderr: '',
      childProcess: childProcess,
    });
  });
}

describe('perform git push', () => {
  test('undo warns when branch was pushed', async () => {
    const logger = new Stubs.LoggerStub();
    const commandStub = new GitPushBranchCommandStub({
      logger,
    });

    await commandStub.do();

    commandStub.createChildProcess.mockClear();

    await commandStub.undo();

    expect(commandStub.createChildProcess).not.toBeCalled();

    expect(logger.warn).toBeCalledWith(`Cannot un-push remote branch '${CMD_CONFIG.branchName}'`);
  });

  test('execution fails when remote branch exists', async () => {
    const logger = new Stubs.LoggerStub();
    const commandStub = new GitPushBranchCommandStub({
      logger,
    });
    const expectedError = new Error(`Remote '${CMD_CONFIG.remote}' already has a branch named '${CMD_CONFIG.branchName}'`);

    commandStub.createChildProcess.mockImplementationOnce(async () => {
      return {
        stderr: '',
        stdout: 'branch exists',
        childProcess: new ChildProcess(),
      };
    });

    await expect(commandStub.do()).rejects.toEqual(expectedError);
  });
});
