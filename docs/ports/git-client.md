# GitClient

An interface ("port") with methods that provides common data needed by the SDK.

The interface defines the following methods:

```ts
interface GitClient {
  /**
   * @param range  - The range to log (see https://git-scm.com/docs/git-log)  
   * @param format - A format of each log entry (see https://git-scm.com/docs/pretty-formats)
   *
   * @returns A promise for an array of log entries (log entry is a string)
   *
   *
   * @example
   *
   * console.log(await gitClient.log("HEAD", "%H")) -> ["eb7f9f87e1a08f0ddc0ea841225a6d7b64ebcf88"];
   */
  log(range: string, format: string): Promise<string[]>;

  /**
   * @param ref - The name of the ref to retrieve the hash for
   *
   * @returns A promise for the ref hash (a string)
   *
   * @example
   *
   * console.log(await gitClient.refHash("HEAD")) -> "eb7f9f87e1a08f0ddc0ea841225a6d7b64ebcf88";
   */
  refHash(ref: string): Promise<string>;

  /**
   * @param ref - The name of the ref to retrieve the abbreivated name for
   *
   * @returns A promise for the ref name (a string)
   *
   * @example
   *
   * console.log(await gitClient.refHash("HEAD")) -> "master";
   */
  refName(ref: string): Promise<string>;

  /**
   * @param range - The range to log (see https://git-scm.com/docs/git-log)  
   *
   * @returns A promise for an array of "commits objects" (see example)
   *
   * @example
   *
   * console.log(await gitClient.commits("HEAD")) -> [{
   *   hash: "eb7f9f87e1a08f0ddc0ea841225a6d7b64ebcf88",
   *
   *   subject: "chore(scope): some text",
   *
   *   body: "This is some additional description",
   *
   *   notes: "123",
   *
   *   tags: ["v0.1.0", "v2.1.0"],
   *
   *   committedTimestamp: 1634136647266,
   *
   *   author: {
   *     name: "Rick Sanchez",
   *     email: "rick.sanchez@show-me-what-got.com",
   *   },
   *
   *   committer: {
   *     name: "Rick Sanchez",
   *     email: "rick.sanchez@show-me-what-got.com",
   *   }
   * }];
   */
  commits(range: string): Promise<Commit[]>;

  /**
   * @param ref - The ref to retrieve merged tags for (see https://git-scm.com/docs/git-tag#Documentation/git-tag.txt---mergedltcommitgt)  
   *
   * @returns A promise for an array of "merged tags objects" (see example)
   *
   * @example
   *
   * console.log(await gitClient.commits("HEAD")) -> [{
   *   hash: "eb7f9f87e1a08f0ddc0ea841225a6d7b64ebcf88",
   *
   *   name: "v1.0.0",
   * }];
   */  
  mergedTags(ref: string): Promise<MergedTag[]>;

  
  /**
   * @param tagName - The tag name to get the remote hash for
   *
   * @returns A promise for the remote tag hash (a string) or null if tag does not exist.
   *
   * @example
   *
   * console.log(await gitClient.commits("v1.0.0")) -> "eb7f9f87e1a08f0ddc0ea841225a6d7b64ebcf88";
   *
   * console.log(await gitClient.commits("v3.0.0")) -> null;
   */   
  remoteTagHash(tagName: string): Promise<string | null>;

  /**
   * @param branchName - The branch name to get the remote hash for
   *
   * @returns A promise for the remote branch hash (a string) or null if branch does not exist.
   *
   * @example
   *
   * console.log(await gitClient.commits("main")) -> "eb7f9f87e1a08f0ddc0ea841225a6d7b64ebcf88";
   *
   * console.log(await gitClient.commits("does not exists")) -> null;
   */  
  remoteBranchHash(branchName?: string): Promise<string | null>;
}
```

See [GitExecaClient](../adapters/git-execa-client.md) for a reference implementation
