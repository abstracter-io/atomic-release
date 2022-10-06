import { Logger } from "../ports/logger";
import { processStdoutLogger } from "../adapters/process-stdout-logger";

type CommandOptions = {
  logger?: Logger;
};

abstract class Command<T extends CommandOptions = CommandOptions> {
  protected readonly logger: Logger;
  protected readonly options: Omit<T, keyof CommandOptions>;

  protected constructor(options?: T) {
    this.options = options ?? ({} as T);

    this.logger = options?.logger || processStdoutLogger({ name: this.getName() });
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

export { Command, CommandOptions };
