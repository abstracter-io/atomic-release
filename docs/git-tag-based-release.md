# gitTagBasedRelease

An implementation of the SDK [Release](./release.md) interface which uses Git tags and [conventional-changelog packages](https://git.io/JKOLR)

### Config

Type: `object literal`

###### Optional properties are denoted by *

#### logger*

Type: [Logger](../ports/logger.md)  
Default: [processStdoutLogger](../adapters/process-stdout-logger.md)

#### gitClient*

Type: [GitClient](./git-client.md)  
Default: [GitExecClient](./git-exec-client.md)

#### filterPreviousVersion*

Type: `function`

A function that accepts a single parameter with the following properties:

```ts
type FilterPreviousVersionContext = {
    version: string; // 1.0.1-beta.0
    preReleaseId: string | null; // The pre release id based on the currrent branch. See the 'preReleaseBranches'
    versionPreReleaseId: string | null; // The version pre release id: '1.0.1-beta.0' -> 'beta'
}
```

The default function returns `true` when `preReleaseId` strictly match `versionPreReleaseId`.

#### remote*

Type: `string`  
Default: `origin`

#### initialVersion*

Type: `string`  
Default: `0.0.0`

The initial version to use with the first release. (This must be a valid semantic version)

#### preReleaseBranches*

Type: `Set<string>`  
Default `new Set(["beta", "alpha"])`

A set of branch names that make up the next version [pre-release identifier](https://git.io/JKkoS).

#### workingDirectory*

Type: `string`  
Default: `process.cwd()`

#### conventionalChangelogPreset*

Type: `object literal`  
Default: [conventional-changelog-conventionalcommits](https://git.io/JrnKG)

A preset exports configuration used by [conventional-changelog-writer](https://git.io/Jrn7b) and by [conventional-commits-parser](https://git.io/vdriu).  
Deciding the next version is done by the preset `whatBump` function.

#### rawConventionalCommits*

Type: `function`

A function that accepts a git log range (a string) and returns a promise for array of object literals. Each object literal
has two properties, "hash" which is the commit hash and "raw" which is a string.

The "raw" value of each element in the array is then mapped to a "conventional commit" by using the conventional-changelog-parser package.

The function by default is:

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
When `false` is returned, the commit will **not** be taken into account when computing the next version.

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
const { SDK } = require("@abstracter/atomic-release");

const release = await SDK.gitTagBasedRelease({
   stableBranchName: "main",

   conventionalChangelogWriterContext: {
     host: "https://github.com",
     owner: "abstracter-io",
     repository: "atomic-release",
     repoUrl: "https://github.com/abstracter-io/atomic-release",
   },
});

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
    semanticRelease.getChangelogByVersion(version).then((changelog) => {
      console.log(version);
      console.log(changelog);
    });
  }
});
```
