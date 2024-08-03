import { vitest, describe, test, expect, beforeEach } from 'vitest';

import { SDK } from '../../src/index.js';

import { Stubs } from '../stubs.js';

const LOGGER = new Stubs.LoggerStub();

describe('strategy', () => {
  let release: InstanceType<typeof Stubs.ReleaseStub>;
  let strategy: InstanceType<typeof Stubs.StrategyStub>;

  beforeEach(async () => {
    release = new Stubs.ReleaseStub();

    strategy = new Stubs.StrategyStub({
      logger: LOGGER,
      release,
      test: 1,
    });

    release.getNextVersion.mockImplementation(() => '2.0.0');

    release.getPreviousVersion.mockImplementation(() => '1.0.0');
  });

  test('config state', async () => {
    expect(strategy).toMatchSnapshot();
  });

  test('commands cleanup is invoked', async () => {
    const commandA = new Stubs.CommandA();
    const commandB = new Stubs.CommandB();
    const cleanupA = vitest.spyOn(commandA, 'cleanup');
    const cleanupB = vitest.spyOn(commandB, 'cleanup');

    strategy.addCommandProvider(async () => {
      return commandA;
    });

    strategy.addCommandProvider(async () => {
      return commandB;
    });

    await strategy.run();

    expect(cleanupA).toBeCalledTimes(1);

    expect(cleanupB).toBeCalledTimes(1);
  });

  test('command error is thrown and logged', async () => {
    const expectedError = new Error('Error');

    // @ts-expect-error protected method can be spied
    vitest.spyOn(strategy, 'getCommands').mockImplementationOnce(() => {
      return [
        {
          getName() {
            return 'Dummy Command';
          },

          do() {
            return Promise.reject(expectedError);
          },

          undo() {
            return Promise.resolve();
          },
        },
      ];
    });

    await expect(strategy.run()).rejects.toStrictEqual(expectedError);

    expect(process.exitCode).toStrictEqual(1);

    expect(LOGGER.error).toBeCalledWith('Strategy execution failed');
  });

  test('undo is invoked for executed commands', async () => {
    const commandA = new Stubs.CommandA();
    const commandB = new Stubs.CommandB();
    const undoA = vitest.spyOn(commandA, 'undo');
    const undoB = vitest.spyOn(commandB, 'undo');

    strategy.addCommandProvider(async () => {
      return commandA;
    });

    strategy.addCommandProvider(async () => {
      return commandB;
    });

    vitest.spyOn(commandB, 'do').mockImplementation(async () => {
      throw new Error('shit');
    });

    await strategy.run().catch(c => c);

    expect(undoA).toBeCalledTimes(1);

    expect(undoB).toBeCalledTimes(1);
  });

  test('commands are executed in specified order', async () => {
    const commandA = new Stubs.CommandA();
    const commandB = new Stubs.CommandB();
    const executedOrder: SDK.Command[] = [];

    strategy.addCommandProvider(async () => {
      return commandA;
    });

    strategy.addCommandProvider(async () => {
      return commandB;
    });

    vitest.spyOn(commandA, 'do').mockImplementation(async () => {
      executedOrder.push(commandA);
    });

    vitest.spyOn(commandB, 'do').mockImplementation(async () => {
      executedOrder.push(commandB);
    });

    await strategy.run();

    expect(executedOrder).toStrictEqual([commandA, commandB]);
  });

  test('does not run when version has not changed', async () => {
    // @ts-expect-error protected method can be spied
    const shouldRunSpy = vitest.spyOn(strategy, 'shouldRun');

    release.getNextVersion.mockImplementationOnce(() => '2.0.0');

    release.getPreviousVersion.mockImplementationOnce(() => '2.0.0');

    await strategy.run();

    expect(await shouldRunSpy.mock.results[0].value).toStrictEqual(false);
  });
});
