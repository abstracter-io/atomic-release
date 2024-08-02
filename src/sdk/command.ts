import { Logger } from "./logger.js";
import { processStdoutLogger } from "./process-stdout-logger.js";

type CommandConfig = {
  logger?: Logger;
};

abstract class Command<T extends CommandConfig = CommandConfig> {
  protected readonly logger: Logger;
  protected readonly config: Omit<T, keyof CommandConfig>;

  public constructor(config?: T) {
    this.config = config ?? ({} as T);

    this.logger = config?.logger ?? processStdoutLogger({ name: this.getName() });
  }

  public getName(): string {
    return this.constructor.name;
  }

  public abstract do(): Promise<void>;

  public undo(): Promise<void> {
    return Promise.resolve(undefined);
  };

  public cleanup(): Promise<void> {
    return Promise.resolve(undefined);
  };
}

export { Command, CommandConfig };
