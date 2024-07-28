# processStdoutLogger

An implementation of the SDK [Logger](./logger.md) interface using `process.stdout`.

### Options

###### Optional properties are denoted by *

Type: `object literal`

##### name

Type: `string` 

##### logLevel*

Type: `string`  
Default: `INFO`

The log level value may be one of the following: "ERROR", "WARN", "INFO" or "DEBUG"

> NOTE: The log level may also be configured using 'ATOMIC_RELEASE_LOG_LEVEL' environment variable.

### Example

```js
const { SDK } = require("@abstracter/atomic-release");

const logger = SDK.processStdoutLogger({ name: "ExamplaryLogger", logLevel: "DEBUG" });

logger.debug("This message is printed because the log level is set to 'DEBUG'");
```
