interface Logger {
  info(message: string): void;

  warn(message: string): void;

  error(error: Error | string): void;

  debug(message: string): void;
}

export { Logger };
