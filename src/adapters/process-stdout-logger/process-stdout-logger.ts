import colors from "colors";

import { Logger } from "../../ports/logger";

type LogLevel = {
  name: string;
  priority: number;
};

type LoggerOptions = {
  name: string;
  logLevel?: "ERROR" | "WARN" | "INFO" | "DEBUG";
};

const COLORED_LOGLEVEL_NAME = {
  INFO: colors.blue("INFO"),
  WARN: colors.yellow("WARN"),
  ERROR: colors.red("ERROR"),
  DEBUG: colors.magenta("DEBUG"),
};

const LOG_LEVELS: LogLevel[] = [
  { name: "ERROR", priority: 0 },
  { name: "WARN", priority: 1 },
  { name: "INFO", priority: 2 },
  { name: "DEBUG", priority: 3 },
];

const getLogLevel = (logLevelName?: string): LogLevel => {
  const name = logLevelName ?? process.env.ATOMIC_RELEASE_LOG_LEVEL ?? "INFO";
  const logLevel = LOG_LEVELS.find((level) => {
    return level.name === name.toUpperCase();
  });

  if (!logLevel) {
    throw new Error(`Unknown log level '${name}'`);
  }

  return logLevel;
};

const messagePrefix = (name: string, logLevelName: string) => {
  const date = new Date();
  const hours = `0${date.getHours()}`.slice(-2);
  const minutes = `0${date.getMinutes()}`.slice(-2);
  const seconds = `0${date.getSeconds()}`.slice(-2);
  const timestamp = `${hours}:${minutes}:${seconds}`;

  return colors.gray(`[${timestamp}] [atomic-release] [${name}] ${logLevelName} ›`);
};

const stdout = (message: string) => {
  return process.stdout.write(`${message}\n`);
};

const processStdoutLogger = (options: LoggerOptions): Logger => {
  const name = options.name;
  const logLevel = getLogLevel(options.logLevel);

  return {
    error(error) {
      if (logLevel.priority >= 0) {
        const err = typeof error === "string" ? new Error(error) : error;
        const formattedMessage = `${messagePrefix(name, COLORED_LOGLEVEL_NAME.ERROR)} ${err.message}`;

        stdout(formattedMessage);

        if (err.stack) {
          stdout(err.stack);
        }
      }
    },

    warn(message) {
      if (logLevel.priority >= 1) {
        const formattedMessage = `${messagePrefix(name, COLORED_LOGLEVEL_NAME.WARN)} ${message}`;

        stdout(formattedMessage);
      }
    },

    info(message) {
      if (logLevel.priority >= 2) {
        const formattedMessage = `${messagePrefix(name, COLORED_LOGLEVEL_NAME.INFO)} ${message}`;

        stdout(formattedMessage);
      }
    },

    debug(message) {
      if (logLevel.priority >= 3) {
        const formattedMessage = `${messagePrefix(name, COLORED_LOGLEVEL_NAME.DEBUG)} ${message}`;

        stdout(formattedMessage);
      }
    },
  };
};

export { processStdoutLogger };
