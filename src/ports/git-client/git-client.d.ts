type Commit = {
  hash: string;

  body: string;

  notes: string | null;

  tags: string[];

  subject: string;

  committedTimestamp: number;

  author: {
    name: string;
    email: string;
  };

  committer: {
    name: string;
    email: string;
  };
};

type MergedTag = {
  hash: string;
  name: string;
};

interface GitClient {
  log(range: string, format: string): Promise<string[]>;

  refHash(ref: string): Promise<string>;

  refName(ref: string): Promise<string>;

  commits(range: string): Promise<Commit[]>;

  mergedTags(ref: string): Promise<MergedTag[]>;

  remoteTagHash(tagName: string): Promise<string | null>;

  remoteBranchHash(branchName?: string): Promise<string | null>;
}

export { GitClient, MergedTag, Commit };
