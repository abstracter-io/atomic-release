interface Logger {
  info(message: string);

  warn(message: string);

  error(error: Error | string);

  debug(message: string);
}

export { Logger };
