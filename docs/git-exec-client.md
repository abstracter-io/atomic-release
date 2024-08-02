# GitExecaClient

An implementation of the SDK [GitClient](./git-client.md) interface using `node:child_process` module.

### Config

###### Optional properties are denoted by *

Type: `object literal`

##### remote*

Type: `string`  
Default: `origin`

##### workingDirectory*

Type: `string`  
Default: `process.cwd()`

### Example

```js
const { SDK } = require("@abstracter/atomic-release");

const gitClient = new SDK.GitExecaClient({ remote: "origin2", workingDirectory: "/some/absolute/path" });
```
