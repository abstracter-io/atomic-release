# GithubCreatePullRequestCommand

A github command that creates a pull request.

### Options

Type: `object literal`

###### Optional properties are denoted by *

##### head

Type: `string`  

##### base

Type: `string`

##### repo

Type: `string`

##### owner

Type: `string`

##### title

Type: `string`

##### body*

Type: `string`

> :information_source: &nbsp; [GithubHttpCommand](github-http-command.md) options are also applicable.

### Example

```js
const { Commands } = require("@abstracter/atomic-release");

const command = new Commands.GithubCreatePullRequestCommand({
  head: "v123-generated-files",
  base: "main",
  repo: "atomic-release",
  owner: "abstracter-io",
  title: "🤖 Adding v23 generated files",
  body: "**Take me to your leader**."
  headers: {
    Authorization: "token PERSONAL-ACCESS-TOKEN",
  },
});
```
