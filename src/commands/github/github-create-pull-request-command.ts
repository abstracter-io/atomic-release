import { MimeTypes, GithubHttpCommand, GithubHttpCommandConfig } from "./github-http-command";

type PullRequestRestResource = Record<string, unknown>;

type GithubCreatePullRequestCommandConfig = GithubHttpCommandConfig & {
  // some-branch
  head: string;

  // main
  base: string;

  // name of the repo
  repo: string;

  // name of repo owner (the org name / user name)
  owner: string;

  // pull request title
  title: string;

  // pull request description "body"
  body?: string;
};

/*
 * Consider creating a command to merge a pull request
 * vs a workflow with some dedicated action...
 * The former will most likely require a dedicated user
 * as a user that opened a pull request cannot approve / merge it
 *
 * https://docs.github.com/en/rest/reference/pulls#create-a-pull-request
 * https://docs.github.com/en/rest/reference/pulls#update-a-pull-request
 */

/**
 @example

 const command = new GithubCreatePullRequestCommand({
    head: "v123-generated-files",
    base: "main",
    repo: "atomic-release",
    owner: "abstracter-io",
    title: "🤖 Adding v23 generated files",
    body: "**Take me to your leader**."
    headers: {
      Authorization: "token PERSONAL-ACCESS-TOKEN",
    },
 });
 */
class GithubCreatePullRequestCommand extends GithubHttpCommand<GithubCreatePullRequestCommandConfig> {
  private createdPullRequest: PullRequestRestResource;

  private async createPullRequest(): Promise<PullRequestRestResource> {
    const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/pulls`;
    const response = await this.fetch(url, {
      method: "POST",

      headers: {
        Accept: MimeTypes.V3,
      },

      body: JSON.stringify({
        head: this.config.head,
        base: this.config.base,
        body: this.config.body,
        title: this.config.title,
      }),
    });

    if (response.status === 201) {
      return (await response.json()) as PullRequestRestResource;
    }

    throw new Error(`Failed to create pull request. Status code is ${response.status}`);
  }

  public async undo(): Promise<void> {
    if (this.createdPullRequest) {
      // Can't delete a pull-request, the next best thing is to close it
      const createdPullRequest = this.createdPullRequest;
      const pullRequestURL = createdPullRequest.html_url;
      const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/pulls/${createdPullRequest.number}`;
      const response = await this.fetch(url, {
        method: "PATCH",

        headers: {
          Accept: MimeTypes.V3,
        },

        body: JSON.stringify({
          state: "closed",
        }),
      });

      if (response.status === 200) {
        this.logger.info(`Closed pull request: ${pullRequestURL}`);
      }
      //
      else {
        this.logger.warn(`Failed to close pull request ${pullRequestURL}. Status code is ${response.status}`);
      }
    }
  }

  public async do(): Promise<void> {
    const pullRequestRestResource = await this.createPullRequest();

    this.createdPullRequest = pullRequestRestResource;

    this.logger.info(`Created pull request: ${pullRequestRestResource.html_url} (id: ${pullRequestRestResource.id})`);
  }
}

export { GithubCreatePullRequestCommand, GithubCreatePullRequestCommandConfig };
