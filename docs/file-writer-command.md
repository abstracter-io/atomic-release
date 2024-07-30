# FileWriterCommand

A command to update a text file content / create file

### Config

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
const { Commands } = require("@abstracter/atomic-release");

const createFileCommand = new Commands.FileWriterCommand({
  create: true,
  content: "This is SPARTA",
  absoluteFilePath: "/home/dev/project/new-file.txt",
});

const prependContentCommnd = new Commands.FileWriterCommand({
  content: "42",
  mode: "prepend",
  absoluteFilePath: "/home/dev/project/existing.txt",
});
```
