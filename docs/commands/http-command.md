# HttpCommand

An abstract class with a method to perform http requests with pre-defined headers using [fetchDefaults](https://github.com/moll/js-fetch-defaults).

### Options

Type: `object literal`

###### Optional properties are denoted by *

##### headers*

Type: `object literal`  

##### fetch?

Type: `function`  
Default: `node-fetch`

### Example

```js
const { HttpCommand } = require("@abstracter/atomic-release/commands");

class ExampleHttpCommand extends HttpCommand {
  async do() {
    await this.fetch("https://api.github.com", {
      method: "HEAD",
    });
  }
}

const command = new ExampleHttpCommand({
  headers: {
    'X-Custom-Header': "This header will be part of the request headers",
  },
});
```
