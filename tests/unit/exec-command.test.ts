import * as process from 'node:process';
import { vitest, describe, test, expect } from 'vitest';

import { Stubs } from '../stubs.js';
import { Commands } from '../../src/index.js';

const CMD_CONFIG: Commands.ExecCommandConfig = {
  logger: new Stubs.NoopLogger(),
  logStd: false,
  workingDirectory: '/this/is/sparta',
};

class ExecCommandStub extends Commands.ExecCommand<any> {
  constructor(config?: Partial<Commands.ExecCommandConfig>) {
    super({ ...CMD_CONFIG, ...config });
  }

  createChildProcess = vitest.fn(async (__args: any) => {
    return {
      stdout: '',
      stderr: '',
      childProcess: Stubs.childProcess(),
    };
  });

  async do() {
    await this.exec('cat', {
      cwd: this.config.workingDirectory,
    });
  };
}

describe('exec command', () => {
  test('log std', async () => {
    const expected = {
      errorMessage: 'error',
      infoMessage: 'info',
    };
    const logger = new Stubs.LoggerStub();
    const commandStub = new ExecCommandStub({ logger, logStd: true });

    commandStub.createChildProcess.mockImplementationOnce(async () => {
      return {
        stderr: expected.errorMessage,
        stdout: expected.infoMessage,
        childProcess: Stubs.childProcess(),
      };
    });

    await commandStub.do();

    expect(logger.info).toBeCalledWith(expected.infoMessage);

    expect(logger.error).toBeCalledWith(expected.errorMessage);
  });

  test('log std using env variable', async () => {
    const expected = {
      errorMessage: 'error',
      infoMessage: 'info',
    };
    const logger = new Stubs.LoggerStub();
    const commandStub = new ExecCommandStub({ logger, logStd: false });

    commandStub.createChildProcess.mockImplementationOnce(async () => {
      return {
        stderr: expected.errorMessage,
        stdout: expected.infoMessage,
        childProcess: Stubs.childProcess(),
      };
    });

    process.env.EXEC_COMMAND_LOG_STD = 'ExecCommandStub';

    await commandStub.do();

    expect(logger.info).toBeCalledWith(expected.infoMessage);

    expect(logger.error).toBeCalledWith(expected.errorMessage);

    delete process.env.EXEC_COMMAND_LOG_STD;
  });
});
