# FileWriterCommand

A command to update a text file content / create file

### Options

Type: `object literal`

###### Optional properties are denoted by *

##### content

Type: `string`  

##### create*

Type: `boolean`  
Default: `false`

Whether to create the file in case it does not exist on disk.

##### absoluteFilePath

Type: `string`  

##### mode*

Type: `string`  
Default: `append`  
Possible values: `replace | prepend | append`

### Examples

```js
const { FileWriterCommand } = require("@abstracter/atomic-release/commands");

const createFileCommand = new FileWriterCommand({
  create: true,
  content: "This is SPARTA",
  absoluteFilePath: "/home/dev/project/new-file.txt",
});

const prependContentCommnd = new FileWriterCommand({
  content: "42",
  mode: "prepend",
  absoluteFilePath: "/home/dev/project/existing.txt",
});
```
