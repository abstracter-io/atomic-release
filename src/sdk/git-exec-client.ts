import { exec, ExecOptions } from '../utils/exec.js';

import type { GitClient, Tag, Commit } from './git-client.js';

type GitExecClientConfig = {
  remote: string;
  workingDirectory: string;
};

class GitExecClient implements GitClient {
  private readonly config: GitExecClientConfig;

  public constructor(config: Partial<GitExecClientConfig> = {}) {
    this.config = {
      remote: config.remote ?? 'origin',
      workingDirectory: config.workingDirectory ?? process.cwd(),
    };
  }

  protected exec = exec;

  protected cli(args: string, config?: ExecOptions) {
    return this.exec(`git ${args}`, {
      cwd: this.config.workingDirectory,
      ...config,
    });
  }

  async log(range: string, format: string): Promise<string[]> {
    const logs: string[] = [];
    const delimiter = ':++:';
    const result = await this.cli(`log ${range} --pretty=format:${format}${delimiter}`);

    for (const log of result.stdout.split(delimiter)) {
      if (log.length) {
        logs.push(log.startsWith('\n') ? log.substring(1) : log);
      }
    }

    return logs;
  }

  async cliVersion(): Promise<string> {
    const { stdout } = await this.cli('--version');

    return stdout.split(' ')[2];
  }

  async refHash(ref: string): Promise<string> {
    const { stdout } = await this.cli(`rev-parse ${ref}`);

    return stdout;
  }

  async refName(ref: string): Promise<string> {
    const { stdout } = await this.cli(`rev-parse --abbrev-ref ${ref}`);

    return stdout;
  }

  /**
   * @param range A git log range.
   *
   * @example
   *
   * const gitClient = new GitClient();
   *
   * // Find all commits since ref 1234 (non-inclusive)
   * const commitSince = await gitClient.commits("1234..");
   *
   * // Find all commits until 1234 (inclusive)
   * const commitsUntil = await gitClient.commits("1234");
   */
  async commits(range: string): Promise<Commit[]> {
    const commits: Commit[] = [];
    const delimiter = ':<>:';
    const tagPattern = /tag: (.*),?/gi;
    // @src https://git-scm.com/docs/pretty-formats
    const formats = ['%H', '%s', '%b', '%N', '%D', '%ct', '%an', '%ae', '%cn', '%ce'];
    const rawCommits = await this.log(range, formats.join(delimiter));

    for (const rawCommit of rawCommits) {
      const tags: string[] = [];
      const logEntry = rawCommit.split(delimiter);

      let match: RegExpExecArray | null = null;

      for (const ref of logEntry[4].split(',')) {
        while ((match = tagPattern.exec(ref))) {
          tags.push(match[1]);
        }
      }

      commits.push({
        hash: logEntry[0],

        subject: logEntry[1],

        body: logEntry[2],

        notes: logEntry[3] ?? null,

        committedTimestamp: parseInt(logEntry[5], 10) * 1000,

        author: {
          name: logEntry[6],
          email: logEntry[7],
        },

        committer: {
          name: logEntry[8],
          email: logEntry[9],
        },

        tags,
      });
    }

    return commits;
  }

  async listTags(): Promise<Tag[]> {
    const tags: Tag[] = [];
    const delimiter = ':++:';
    const { stdout } = await this.cli(`tag --format=%(refname:strip=2)${delimiter}%(objectname)`);

    for (const tag of stdout.split('\n')) {
      if (tag.length) {
        const [name, hash] = tag.split(delimiter);

        tags.push({
          hash,
          name,
        });
      }
    }

    return tags;
  }

  async remoteTagHash(tagName: string): Promise<string | null> {
    const { stdout } = await this.cli(`ls-remote ${this.config.remote} -t refs/tags/${tagName}`);

    if (stdout.length) {
      return stdout.split('\t')[0];
    }

    return null;
  }

  async remoteBranchHash(branchName?: string): Promise<string | null> {
    const branch = branchName ?? (await this.refName('HEAD'));
    const { stdout } = await this.cli(`ls-remote ${this.config.remote} -h refs/heads/${branch}`);

    if (stdout.length) {
      return stdout.split('\t')[0];
    }

    return null;
  }
}

export { GitExecClient, GitExecClientConfig, Tag };
