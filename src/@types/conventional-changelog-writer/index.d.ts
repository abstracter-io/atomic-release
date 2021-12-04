declare module "conventional-changelog-writer" {
  import { ConventionalCommit } from "conventional-commits-parser";

  // https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-writer#context
  export type ChangelogWriterContext = {
    version?: string;
    title?: string;
    isPatch?: boolean;
    host: string;
    owner: string;
    repository: string;
    repoUrl: string;
    linkReferences?: boolean;
    commit?: string;
    issue?: string;
    date?: string;
  };

  // https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-writer#options
  export type ChangelogWriterOptions = {
    // commit.raw?
    transform: (commit: ConventionalCommit) => ConventionalCommit;

    groupBy?: string;

    commitGroupsSort: (a: ConventionalCommit, b: ConventionalCommit) => number | string[];
    commitsSort?: (a: ConventionalCommit, b: ConventionalCommit) => number | string[];

    noteGroupsSort: (a: ConventionalCommit, b: ConventionalCommit) => number | string[];
    notesSort: (a: ConventionalCommit, b: ConventionalCommit) => number | string[];

    generateOn?: (commit: ConventionalCommit) => boolean | string;

    finalizeContext?: (
      context: ConventionalChangelogWriterContext,
      options: ConventionalParserOptions,
      commits: ConventionalCommit[],
      keyCommit: ConventionalCommit
    ) => ConventionalChangelogWriterContext;

    debug?: () => void;

    reverse?: boolean;

    includeDetails?: boolean;

    ignoreReverted?: boolean;

    doFlush?: boolean;

    mainTemplate?: string;

    headerPartial?: string;

    commitPartial?: string;

    footerPartial?: string;

    partials?: Record<string, string>;
  };

  function writer(context: ChangelogWriterContext, options: ChangelogWriterOptions): any;

  // eslint-disable-next-line import/no-default-export,@typescript-eslint/explicit-module-boundary-types
  export default writer;
}
