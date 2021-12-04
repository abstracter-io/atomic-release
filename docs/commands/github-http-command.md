# GithubHttpCommand

An abstract class with a method to expand github URLs and perform HTTP requests using the fetch API.

### Options

This class accpets the same options as [HttpCommand](http-command.md)

### Example

```js
const { GithubHttpCommand } = require("@abstracter/atomic-release/commands");

class ExampleGithubHttpCommand extends GithubHttpCommand {
   async do() {
    const url = this.expendURL("https://api.github.com/{owner}/{repo}", {
      owner: "abstracter-io",
      repo: "atomic-release",
    });
    
    await this.fetch(url, { method: "HEAD" });
   }
}
```
