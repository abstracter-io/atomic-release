interface Release {
  listVersions(max: number): Promise<string[]>;

  getChangelog(): Promise<string | null>;

  getNextVersion(): Promise<string>;

  getPreviousVersion(): Promise<string>;

  getMentionedIssues(): Promise<Set<string>>;

  getChangelogByVersion(version: string): Promise<string | null>;
}

export { Release };
