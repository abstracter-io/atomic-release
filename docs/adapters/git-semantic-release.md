# gitSemanticRelease

An implementation of the SDK [Release](ports/release.md) interface that generates changelogs and  
semantic versions using [conventional-changelog packages](https://git.io/JKOLR)

### Options

Type: `object literal`

###### Optional properties are denoted by *

#### logger*

Type: [Logger](../ports/logger.md)  
Default: [processStdoutLogger](../adapters/process-stdout-logger.md)

#### gitClient*

Type: [GitClient](../ports/git-client.md)  
Default: [GitExecaClient](../adapters/git-execa-client.md)

#### remote*

Type: `string`  
Default: `origin`

#### initialVersion*

Type: `string`  
Default: `0.0.0`

The initial version to use with the first release. (This must be a valid semantic version)

#### stableBranchName

Type: `string`

The name of the branch from which stable versions are released.

"v1.0.0" is a stable version  
"v1.1.0-beta.0" is a pre release version ("beta");

#### preReleaseBranches*

Type: `object literal`  
Default `{}`

An object literal where properties are branch names, and properties values are the version [pre-release identifier](https://git.io/JKkoS).

```js
// releasing branch "beta" will use the value "unstable" as a version pre release id (e.g. "v1.1.0-unstable.0")
{ "beta": "unstable" }
```

#### workingDirectory*

Type: `string`  
Default: `process.cwd()`

#### conventionalChangelogPreset*

Type: `object literal`  
Default: [conventional-changelog-conventionalcommits](https://git.io/JrnKG)

A preset exports configuration used by [conventional-changelog-writer](https://git.io/Jrn7b) ([writer-opts.js](https://git.io/Jrcv5))  
and by [conventional-commits-parser](https://git.io/vdriu) ([parser-opts.js](https://git.io/JrceV)).  
Deciding the next version is done by the preset [whatBump](https://git.io/Jsf2Y) function.

#### rawConventionalCommits*

Type: `function`

A callback that accepts a git log range (a string) and returns a promise for array of object literals. Each object literal
has two properties, "hash" which is the commit hash and "raw" which is a string.

The "raw" value of each element in the array is then mapped to a "conventional commit" by using the conventional-changelog-parser package.

The callback by default is:

```js
const rawConventionalCommits = async (range) => {
  const commits = await gitClient.commits(range);

  return commits.map((commit) => {
    const lines = [
      // subject
      `${commit.subject}`,

      // body
      `${commit.body}`,

      // extra fields are denoted by hypens and will be available in the parsed object.
      "-hash-",
      `${commit.hash}`,

      "-gitTags-",
      `${commit.tags.join(",")}`,

      "-committerDate-",
      `${new Date(commit.committedTimestamp)}`,
    ];

    return {
      hash: commit.hash,
      raw: lines.join("\n"),
    };
  });
};
```

#### isReleaseCommit*

Type: `function`

A callback that accepts a "conventional commit", and returns a boolean.
When `true` is returned, the commit will not be taken into account when computing the next version.

The default callback is:

> ⚠️ &nbsp; If you are using a conventional-changelog preset other than "conventional-changelog-conventionalcommits" you need to provide a custom callback.

```js
const isReleaseCommit = (commit) => {
  const type = commit.type;

  if (!Object.prototype.hasOwnProperty.call(commit, "type")) {
    throw new Error("Non supported conventional commit. Provide a custom filter.");
  }

  if (typeof type === "string") {
    return /feat|fix|perf/.test(type);
  }

  return false;
};
```

#### conventionalChangelogWriterContext*

Type: `object literal`

This is used by [conventional-changelog-writer](https://git.io/Jrn7b) when generating changelogs.

Read about it here: [README.md#context](https://git.io/Jrnys)

> ⚠️ &nbsp; An error will be thrown if trying to generate a changelog without providing this property.
 
> ℹ &nbsp; Please note that "version" property is automatically added to the object literal.

### Example:

```js
const { gitSemanticRelease } = require("@abstracter/atomic-release/adapters/git-conventional-release");

const semanticRelease = gitSemanticRelease({
   stableBranchName: "main",

   conventionalChangelogWriterContext: {
     host: "https://github.com",
     owner: "abstracter-io",
     repository: "atomic-release",
     repoUrl: "https://github.com/abstracter-io/atomic-release",
   },
});

// release is a promise
semanticRelease.then((release) => {
  // Print the next version (a string)
  release.getNextVersion().then(console.log);

  // Print the next version changelog (a string)
  release.getChangelog().then(console.log);

  // Print previous version (a string])
  release.getVersion().then(console.log);

  // Print a set of issues mentiond in the commits to be released
  //
  // Note: To configure how issues are matched within commits logs
  // create a custom conventional-changelog preset using [parser options](https://git.io/JrWp3)
  // and make sure to include the preset in semanticRelease options (see the docs for "conventionalChangelogPreset")
  release.getMentionedIssues().then(console.log);

  // Print all the previous versions (an array of versions -> ["1.0.1", "0.8.1"], and then their changelogs
  release.getPreviousVersion().then((versions) => {
    console.log(versions);

    // Print each previous version changelog
    for (const version of versions) {
      gitConventionalRelease.getChangelogByVersion(version).then((changelog) => {
        console.log(version);
        console.log(changelog);
      });
    }
  });
});
```
