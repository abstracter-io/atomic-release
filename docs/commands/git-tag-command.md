# GitTagCommand

A git command to create a local/remote tag.

### Options

Type: `object literal`

###### Optional properties are denoted by *

##### name

Type: `string`  

##### remote

Type: `string`  
Default: `origin`

> :information_source: &nbsp; [ExecaCommand](execa-command.md) options are also applicable.

### Example

```js
const { GitTagCommand } = require("@abstracter/atomic-release/commands");

const command = new GitTagCommand({
  name: "v1.0.0",
  remote: "custom-remote",
});
```
