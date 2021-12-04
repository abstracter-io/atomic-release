interface Release {
  getChangelog(): Promise<string | null>;

  getVersions(): Promise<string[]>;

  getNextVersion(): Promise<string>;

  getPreviousVersion(): Promise<string>;

  getMentionedIssues(): Promise<Set<string>>;

  getChangelogByVersion(version: string): Promise<string | null>;
}

export { Release };
