import to from "await-to-js";

import { Command } from "./command";
import { timer } from "../utils/timer";
import { Logger } from "../ports/logger";
import { Release } from "../ports/release";
import { processStdoutLogger } from "../adapters/process-stdout-logger";

type StrategyOptions = {
  logger?: Logger;
  release: Release;
};

abstract class Strategy<T extends StrategyOptions> {
  protected readonly logger: Logger;
  protected readonly options: Omit<T, "logger">;

  protected constructor(options: T) {
    this.options = options ?? ({} as T);

    this.logger = options.logger ?? processStdoutLogger({ name: this.getName() });
  }

  private async executeCommands(atomicCommands: Command[]): Promise<void> {
    const logger = this.logger;
    const commandsCount = atomicCommands.length;

    for (let i = 0, l = commandsCount; i < l; i += 1) {
      const command = atomicCommands[i];
      const executeTimer = timer();
      const commandName = command.getName();

      logger.debug(`Executing command '${commandName}'`);

      // eslint-disable-next-line no-await-in-loop
      const [error] = await to(command.do());

      logger.debug(`Executing command '${commandName}' completed in ~${executeTimer}`);

      if (error) {
        logger.warn(`An error occurred while executing command '${commandName}'`);

        logger.error(error);

        while (i !== -1) {
          const command = atomicCommands[i];
          // eslint-disable-next-line no-await-in-loop
          const [undoError] = await to(command.undo());

          if (undoError) {
            logger.warn(`An error occurred while undoing command '${command.getName()}'`);

            logger.error(undoError);
          }

          i -= 1;
        }

        throw error;
      }
    }
  }

  protected abstract shouldRun(): Promise<boolean>;

  protected abstract getCommands(): Promise<Command[]>;

  protected getName(): string {
    return this.constructor.name;
  }

  public async run(): Promise<void> {
    try {
      const shouldRun = await this.shouldRun();

      if (shouldRun) {
        const commands = await this.getCommands();
        const nextVersion = await this.options.release.getNextVersion();
        const prevVersion = await this.options.release.getPreviousVersion();

        this.logger.info(`Next version is ${nextVersion}`);
        this.logger.info(`Previous version is ${prevVersion}`);

        this.logger.debug(`Executing ${commands.length} commands`);

        if (commands.length) {
          const executionTimer = timer();

          await this.executeCommands(commands);

          this.logger.info(`Execution completed in ~${executionTimer}`);
        }
        //
        else {
          this.logger.warn(`Strategy ${this.getName()} has no commands`);
        }
      }

      this.logger.info("All done...");
    }
    catch (e) {
      process.exitCode = 1;

      throw e;
    }
  }
}

export { StrategyOptions, Strategy };
