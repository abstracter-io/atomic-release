# GithubCreateIssueCommentsCommand

A github command that creates a github release.

### Options

Type: `object literal`

###### Optional properties are denoted by *

##### repo

Type: `string`  

##### owner

Type: `string`

##### tagName

Type: `string`

##### isStable*

Type: `boolean`  
Default: `false`

Use `true` to mark the created release as stable.

##### name

Type: `string`

##### body*

Type: `string`

##### assets*

Type: `array`

An array of object literals where each object is an asset to upload to the release.

> :information_source: &nbsp; [GithubHttpCommand](github-http-command.md) options are also applicable.

### Example

```js
const { GithubCreateIssueCommentsCommand } = require("@abstracter/atomic-release/commands");

const command = new GithubCreateReleaseCommand({
  owner: "abstracter-io",
  repo: "atomic-release",
  tagName: "v2.0.1",
  isStable: true,
  name: "RELEASE v2.0.1",
  body: "***This is SPARTA***",
  headers: {
    Authorization: "token [PERSONAL ACCESS TOKEN]",
  },
  assets: [
    { absoluteFilePath: "/home/rick/dev/package.json" },
    { absoluteFilePath: "/home/rick/dev/build.json", label: "..." },
    { absoluteFilePath: "/home/rick/dev/package.json", name: "custom name" },
  ],
});
```
