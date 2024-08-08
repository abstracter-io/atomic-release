import { vitest, describe, test, expect } from 'vitest';

import { Stubs } from '../stubs.js';
import { Commands } from '../../src/index.js';

const PACKAGE_JSON = {
  private: false,
  name: '@scope/name',
  version: '0.1.0',
};

const CMD_CONFIG: Commands.NpmPublishPackageCommandConfig = {
  logger: Stubs.NoopLogger.INSTANCE,

  tag: 'dummy',

  workingDirectory: '/fake/path',
};

class NpmPublishPackageCommandStub extends Commands.NpmPublishPackageCommand {
  public constructor(config?: Partial<Commands.NpmPublishPackageCommandConfig>) {
    super({ ...CMD_CONFIG, ...config });
  }

  getPackageJson = vitest.fn(async () => {
    return PACKAGE_JSON;
  });

  public createChildProcess = vitest.fn(async (_args: any) => {
    return {
      stdout: '',
      stderr: '',
      childProcess: Stubs.childProcess(),
    };
  });
}

describe('publish npm package', () => {
  const PACKAGE_NAME_AND_VERSION = `${PACKAGE_JSON.name}@${PACKAGE_JSON.version}`;

  test('errors when exit code is not 0', async () => {
    const code = 127;
    const commandStub = new NpmPublishPackageCommandStub();

    commandStub.createChildProcess.mockImplementationOnce(async () => {
      const childProcess = Stubs.childProcess();

      // @ts-ignore
      childProcess.exitCode = code;

      return {
        stderr: '',
        stdout: '',
        childProcess,
      }
    })

    await expect(commandStub.do()).rejects.toStrictEqual(new Error(`Publish failed. exit code is ${code}`));
  });

  test('publishing to a specified dist tag', async () => {
    const logger = new Stubs.LoggerStub();
    const commandStub = new NpmPublishPackageCommandStub({
      logger,
    });

    await commandStub.do();

    expect(logger.info).toBeCalledWith(`Publishing '${PACKAGE_NAME_AND_VERSION}' using dist tag '${CMD_CONFIG.tag}'`);

    expect(commandStub.createChildProcess).toBeCalledWith({ command: 'npm', args: ['publish', '--tag', CMD_CONFIG.tag ]}, {
      cwd: CMD_CONFIG.workingDirectory,
    });
  });

  test('publishing to a specified registry', async () => {
    const logger = new Stubs.LoggerStub();
    const expectedRegistry = 'https://npm.local.registry';
    const commandStub = new NpmPublishPackageCommandStub({
      logger,
      tag: undefined,
      registry: expectedRegistry,
    });

    await commandStub.do();

    expect(logger.info).toBeCalledWith(`Publishing '${PACKAGE_NAME_AND_VERSION}' to registry '${expectedRegistry}'`);

    expect(commandStub.createChildProcess).toBeCalledWith({ command: 'npm', args: ['publish', '--registry', expectedRegistry] }, {
      cwd: CMD_CONFIG.workingDirectory,
    });
  });

  test('publishing is skipped when package is private', async () => {
    const logger = new Stubs.LoggerStub();
    const commandStub = new NpmPublishPackageCommandStub({ logger });

    commandStub.getPackageJson.mockImplementation(async () => {
      return {
        ...PACKAGE_JSON,
        private: true,
      };
    });

    await commandStub.do();

    expect(commandStub.createChildProcess).not.toBeCalled();

    expect(logger.info).toBeCalledWith(`Skipping publish. Package '${PACKAGE_JSON.name}' private property is true.`);
  });

  test('undo does not unpublish when package was not published', async () => {
    const expectedError = new Error('Some failure');
    const commandStub = new NpmPublishPackageCommandStub();

    commandStub.createChildProcess.mockImplementationOnce(async () => {
      throw expectedError;
    });

    const error = await commandStub.do().catch(e => e);

    await commandStub.undo();

    expect(error).toEqual(error);

    expect(commandStub.createChildProcess).not.toBeCalledWith('npm unpublish', {
      cwd: CMD_CONFIG.workingDirectory,

    });
  });

  test('undo does not unpublish when "undoPublish" is not true', async () => {
    const commandStub = new NpmPublishPackageCommandStub();

    await commandStub.do();

    await commandStub.undo();

    expect(commandStub.createChildProcess).not.toBeCalledWith('npm unpublish', {
      cwd: CMD_CONFIG.workingDirectory,

    });
  });

  test('undo unpublish when package was published and "undoPublish" is true', async () => {
    const commandStub = new NpmPublishPackageCommandStub({
      undoPublish: true,
    });

    await commandStub.do();

    await commandStub.undo();

    expect(commandStub.createChildProcess).toBeCalledWith({ command: 'npm', args: ['unpublish', PACKAGE_NAME_AND_VERSION] }, {
      cwd: CMD_CONFIG.workingDirectory,
    });
  });
});
