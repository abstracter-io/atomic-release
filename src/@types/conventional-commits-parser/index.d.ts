declare module "conventional-commits-parser" {
  export type ConventionalCommitReference = {
    action: string | null;
    owner: string | null;
    repository: string | null;
    issue: string | null;
    raw: string;
    prefix: string;
  };

  // Typing is based on the properties in:
  // node_modules/conventional-commits-parser/lib/parser.js#289
  export type ConventionalCommit = {
    merge: string | null;
    header: string | null;
    body: string | null;
    footer: string | null;
    notes: string[];
    references: ConventionalCommitReference[];
    mentions: string[];
    [k: string]: unknown;
  };

  // https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-commits-parser#options
  export type ConventionalCommitsParserOptions = {
    mergePattern?: RegExp | string;
    mergeCorrespondence?: string | string[];

    headerPattern: RegExp | string;
    headerCorrespondence: string[];

    referenceActions?: string[];

    issuePrefixes?: string[];
    issuePrefixesCaseSensitive?: boolean;

    noteKeywords?: string[];
    notesPattern?: (noteKeywordsSelection: string) => RegExp;

    fieldPattern?: RegExp | string;

    revertPattern?: RegExp | string;

    revertCorrespondence?: string[];

    commentChar?: string | null;

    warn: boolean | ((message: string) => void);
  };

  export function sync(commitBody: string, options?: ConventionalCommitsParserOptions): ConventionalCommit;
}
