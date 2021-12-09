# NpmPublishPackageCommand

A command that updates the version property in a `package.json` file.

**NOTE**: THIS COMMAND SHOULD BE THE LAST COMMAND THAT EXECUTES DURING A RELEASE.

```
The commonly used registry (https://registry.npmjs.org) does  
allow removing a published package but does not allow publishing  
the same version even though it was unpublished... :facepalm:  

Assuming the registry in use does not impose     
such a limit, there is an option called "undoPublish" that will  
control whether this command undo should "unpublish"
```

### Options

Type: `object literal`

###### Optional properties are denoted by *

##### tag*

Type: `string`  
Default: `latest`

The npm dist-tag to publish to.

##### registry*

Type: `string`  

This is optionl since NPM CLI fallbacks to using the publish config section in the package.json.

##### undoPublish

Type: `boolean`  
Default: false

Use `true` only when the registry allows publishing the same version again.

> :information_source: &nbsp; [ExecaCommand](execa-command.md) options are also applicable.

### Example

```js
const { NpmPublishPackageCommand } = require("@abstracter/atomic-release/commands");

const command = new NpmPublishPackageCommand({
  tag: "beta", // i.e. npm install <packageName>@beta
  registry: "https://npm.evil-corp.com"
  undoPublish: false,
  workingDirectory: "/absolute/path", // package.json should be inside
});
```
