# Logger

An interface ("port") that outputs messages logged by the SDK depending on the log level.

### Creating a Custom Logger

Here is an example of creating a logger adhering to the logger interface using the global console object.

```js
const consoleLogger = (logLevel) => {
  return {
    /**
     * error - a string or an instance of an error
     */
    error(error) {
      if (logLevel >= 0) {
         console.error(error);
      }
    },

    warn(message) {
      if (logLevel >= 1) {
        console.warn(message);
      }
    },

    info(message) {
      if (logLevel >= 2) {
        console.info(message);
      }
    },

    debug(message) {
      if (logLevel >= 3) {
        console.debug(message);
      }
    },
  };
};

// A silent logger
// const logger = consoleLogger(-1);

// errors only
// const logger = consoleLogger(0);

// errors and warnings
// const logger = consoleLogger(1);

// errors, warnings, and info
// const logger = consoleLogger(2);

// errors, warnings, info, and debug
// const logger = consoleLogger(3);

logger.error(new Error("Oh snap"));

logger.error("Oh snap");

logger.warn("this is a warning");

logger.info("this is informational");

logger.debug("this helps troubleshooting");
```

See [processStdoutLogger](../adapters/process-stdout-logger.md) for a reference implementation
