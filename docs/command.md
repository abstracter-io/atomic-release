# Command

A command is an object with two key methods, "do" which performs an action, and "undo" which rolls back  
any actions taken by the "do" method.

### Options

###### Optional properties are denoted by *

Type: `object literal`

##### logger*

Type: [Logger](ports/logger.md)  
Default: [processStdoutLogger](adapters/process-stdout-logger.md)

### Creating a Custom Command

Here's an example showing how to create a command:

```js
const fs = require("fs");
const { Command } = require("@abstracter/atomic-release");

class CreateFolderCommand extends Command {
    constructor(options) {
        super(options);
        
        this.createdFolder = false;
    }

    /**
     * This method deletes the created dirPath
     *
     * return value is a promise for a void/undefined
     */
    async undo() {
        if (this.createdFolder) {
            await fs.promises.rmdir(this.options.dirPath, { recursive: true });
        
            this.logger.info(`Deleted created folder ${this.options.dirPath}`);
        }
    }
    
    /**
     * This method will create a directory path (like mkdir -p)
     *
     * return value is a promise for a void/undefined
     */
    async do() {
        await fs.promises.mkdir(this.options.dirPath, { recursive: true });
        
        this.logger.info(`Created ${this.options.dirPath}`);
        
        this.createdFolder = true;
    }
}

// Usage example:
// ==============
const command = new CreateFolderCommand({ dirPath: `${process.cwd()}/this/is/sparta` });

// This will create the 'dirPath'
await command.do();

// This will delete the created 'dirPath'
await command.undo();
```
