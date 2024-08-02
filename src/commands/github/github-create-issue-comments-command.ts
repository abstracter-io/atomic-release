import { GithubHttpCommand, GithubHttpCommandConfig } from "./github-http-command.js";

type CommentRestResource = Record<string, unknown>;

type IssueComment = {
  commentBody: string;
  issueNumber: number;
};

type GithubCreateIssueCommentsCommandConfig = GithubHttpCommandConfig & {
  repoName: string;
  repoOwner: string;
  issueComments: IssueComment[];
};

/**
 @example
 const command = new GithubCreateIssueCommentsCommand({
    owner: "abstracter-io",

    repo: "atomic-release",

    issueComments: [
      { issueNumber: 1, commentBody: "Commenting in issue number 1 🥳" },
      { issueNumber: 1, commentBody: "**Another message in issue #1**" },
      { issueNumber: 2, commentBody: "Some other issue" },
    ],

    headers: {
      Authorization: "token PERSONAL-ACCESS-TOKEN",
    },
  });
 */
class GithubCreateIssueCommentsCommand extends GithubHttpCommand<GithubCreateIssueCommentsCommandConfig> {
  private readonly createdCommentsResources: CommentRestResource[] = [];

  private async createComment(issueComment: IssueComment): Promise<Response | null> {
    const { repoOwner, repoName } = this.config;
    const { issueNumber, commentBody } = issueComment;
    const url = this.expendURL("https://api.github.com/repos/{owner}/{repo}/issues/{issueNumber}/comments", {
      owner: repoOwner,
      repo: repoName,
      issueNumber,
    });
    const response = await this.fetch(url, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        body: commentBody,
      }),
    });
    const statusCode = response.status;

    if (statusCode === 404 || response.status === 410) {
      this.logger.info(`Could not find issue '${issueNumber}'. Comment was not created.`);

      return null;
    }

    if (response.status !== 201) {
      throw new Error(`Failed to create a comment in issue '${issueNumber}'. Status code is ${response.status}`);
    }

    return response;
  }

  private async deleteComment(commentResource: CommentRestResource): Promise<void> {
    const { repoOwner, repoName } = this.config;
    const url = this.expendURL("https://api.github.com/repos/{owner}/{repo}/issues/comments/{commentId}", {
      repo: repoName,
      owner: repoOwner,
      commentId: commentResource.id as string,
    });
    const response = await this.fetch(url, {
      method: "DELETE",
    });
    const statusCode = response.status;
    const commentURL = commentResource.html_url;

    if (statusCode === 204) {
      this.logger.info(`Deleted comment: ${commentURL}`);
    }
    //
    else {
      this.logger.warn(`Failed to delete comment '${commentURL}'. Status code is ${statusCode}`);
    }
  }

  public async do(): Promise<void> {
    const comments: Promise<void>[] = [];

    for (const issueComment of this.config.issueComments) {
      const createComment = async (): Promise<void> => {
        const response = await this.createComment(issueComment);

        if (response) {
          const resource = await response.json() as any;

          this.createdCommentsResources.push(resource);

          this.logger.info(`Created comment: ${resource.html_url} (id: ${resource.id})`);
        }
      };

      comments.push(createComment());
    }

    await Promise.all(comments);
  }

  public async undo(): Promise<void> {
    const deletions = this.createdCommentsResources.map((resource) => {
      return this.deleteComment(resource);
    });

    await Promise.all(deletions);
  }
}

export { GithubCreateIssueCommentsCommand, GithubCreateIssueCommentsCommandConfig };
