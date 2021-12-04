# Release

An interface ("port") for providing information needed to perform a release.

The interface defines the following methods:

```ts
interface Release {
  /**
   * @returns A promise for a changelog of the commits included in the release
   */
  getChangelog(): Promise<string>;

  /**
   * @returns A promise for an array of all the previous released versions
   */
  getVersions(): Promise<string[]>;

  /**
   * @returns A promise for the next version
   */
  getNextVersion(): Promise<string>;

  /**
   * @returns A promise for the previous released version
   */
  getPreviousVersion(): Promise<string>;

  /**
   * @returns A promise for the issues mentiond in the commits included in the release
   */
  getMentionedIssues(): Promise<Set<string>>;

  /**
   * @param version - A previously released version
   *
   * @returns A promise for a changelog of a previously released version
   */
  getChangelogByVersion(version: string): Promise<string>;
}
```

See [gitSemanticRelease](../adapters/git-semantic-release.md) for a reference implementation
