# GithubCreateIssueCommentsCommand

A github command that comments in github issues.

### Config

Type: `object literal`

###### Optional properties are denoted by *

##### repo

Type: `string`  

##### owner

Type: `string`

##### issueComments

Type: `array`

An array of object literals where each object is an issue number and the comment body.

> :information_source: &nbsp; [GithubHttpCommand](github-http-command.md) options are also applicable.

### Example

```js
const { Commands } = require("@abstracter/atomic-release");

const command = new Commands.GithubCreateIssueCommentsCommand({
  owner: "abstracter-io",

  repo: "atomic-release",

  issueComments: [
    { issueNumber: 1, commentBody: "Commenting in issue number 1 🥳" },
    { issueNumber: 1, commentBody: "**Another message in issue #1**" },
    { issueNumber: 2, commentBody: "Some other issue" },
  ],

  headers: {
    Authorization: "token PERSONAL-ACCESS-TOKEN",
  },
});
```
