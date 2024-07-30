import to from "await-to-js";

import { Logger } from "./logger";
import { Release } from "./release";
import { Command } from "./command";

import { timer } from "../utils/timer";

type StrategyConfig = {
  logger: Logger;
  release: Release;
};

type CommandProvider<T> = (config: T) => Promise<Command | null>;

type CommandsCollection = (Command | null)[];

class Strategy<T extends StrategyConfig = StrategyConfig> {
  protected readonly config: T;
  protected readonly commandProviders: Array<CommandProvider<T>>

  public constructor(config: T) {
    this.config = config;
    this.commandProviders = [];
  }

  private async executeCommands(commands: CommandsCollection): Promise<void> {
    const logger = this.config.logger;

    for (let i = 0, l = commands.length; i < l; i += 1) {
      const command = commands[i];

      if (command) {
        const commandName = command.getName();
        const executeTimer = timer();

        logger.debug(`Executing command '${commandName}'`);

        // eslint-disable-next-line no-await-in-loop
        const [error] = await to(command.do());

        logger.debug(`Executing command '${commandName}' completed in ~${executeTimer}`);

        if (error) {
          logger.warn(`An error occurred while executing command '${commandName}'`);

          logger.error(error);

          while (i !== -1) {
            const command = commands[i];

            if (command) {
              // eslint-disable-next-line no-await-in-loop
              const [error] = await to(command.undo());

              if (error) {
                logger.error(`An error occurred while undoing command '${command.getName()}'`);

                logger.error(error);
              }
            }

            i -= 1;
          }

          throw error;
        }
      }
    }
  }

  protected async shouldRun(): Promise<boolean> {
    const [nextVersion, prevVersion] = await Promise.all([
      this.config.release.getNextVersion(),
      this.config.release.getPreviousVersion()
    ]);

    this.config.logger.info(`Next version is ${nextVersion}`);

    this.config.logger.info(`Previous version is ${prevVersion}`);

    if (nextVersion === prevVersion) {
      this.config.logger.warn('No version change detected');

      return false;
    }

    return true;
  }

  protected async getCommands(): Promise<(Command | null)[]> {
    const commands: (Command | null)[] = [];

    await Promise.all(this.commandProviders.map(async (p, i) => {
      commands[i] = await p(this.config);
    }));

    return commands;
  }

  public addCommandProvider(provider: CommandProvider<T>) {
    this.commandProviders.push(provider);

    return this;
  }

  public async run(): Promise<void> {
    const logger = this.config.logger;

    try {
      const shouldRun = await this.shouldRun();

      if (shouldRun) {
        const commands = await this.getCommands();

        logger.info(`Executing ${commands.length} commands...`);

        if (commands.length) {
          const executionTimer = timer();

          logger.info("Executing commands...");

          await this.executeCommands(commands);

          logger.info("Cleaning up...");

          await Promise.all(commands.map(async (command) => {
            try {
              if (command) {
                await command.cleanup();
              }
            } catch (e) {
              logger.warn(e);
            }
          }));

          logger.info(`Execution completed in ~${executionTimer}`);
        }
        else {
          logger.warn("Strategy has no commands");
        }
      }

      logger.info("All done");
    }
    catch (e) {
      process.exitCode = 1;

      logger.error("Commands execution failed");

      logger.error(e);

      throw e;
    }
  }
}

export { Strategy, StrategyConfig };
