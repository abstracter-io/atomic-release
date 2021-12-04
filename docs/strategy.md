# Strategy

A strategy is an object with two key methods, "getCommands" which provides an array of commands to execute and  
"shouldRun" which decides whether to execute the strategy commands.

### Options

###### Optional properties are denoted by *
  
##### logger*

Type: [Logger](ports/logger.md)  
Default: [processStdoutLogger](src/adapters/process-stdout-logger/process-stdout-logger.ts)

##### release

Type: [Release](ports/release.md)

### Creating a Custom Strategy

Here's an example showing how to create a strategy:

```js
const { Strategy } = require("@abstracter/atomic-release");
const { FileWriterCommand } = require("@abstracter/atomic-release/commands/file-writer-command");

class MyCustomStrategy extends Strategy {
  shouldRun() {
    // return value is a promise to a boolean
    return new Promise((resolve) => {
      const day = new Date().getDay() + 1;
      
      // run release only in even days...
      resolve((day % 2) === 0);
    })
  }
  
  // return value is a promise to an array of command instances (using the async keyword for brevity)
  async getCommands() {
      const commands = [];
  
      commands.push(new FileWriterCommand({
        create: true,
        mode: "replace",
        absoluteFilePath: `${process.cwd()}/next-version.txt",
        content: `Next version is ${await this.options.release.getNextVersion()}`,
      }));

      return commands;
  }
}

// NOTE: logger and release are psudeo arguments
const strategy = new MyCustomStrategy({ release, logger });

// Run the strategy: (an error in any of the strategy commands will roll back previous commands by executing their "undo" method)
strategy.run().catch((e) => {
  console.error("Oh snap");
})
```
