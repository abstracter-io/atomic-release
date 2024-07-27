import to from "await-to-js";
import { vitest, describe, test, expect, beforeEach } from "vitest";

import { Stubs } from "../stubs";
import { Commands } from "../../src";

const fetch = vitest.fn();

const LOGGER = new Stubs.LoggerStub();

const CMD_CONFIG: Commands.GithubCreatePullRequestCommandConfig = {
  logger: LOGGER,
  fetch,

  owner: "nintendo",
  repo: "super-mario",
  base: "main",
  head: "version-123-generated-files",
  title: "[Atomic Release] v123 generated files",
  body: "This is sparta",

  headers: {
    "X-Custom-Header": "1",
  },
};

class GithubCreatePullRequestCommandStub extends Commands.GithubCreatePullRequestCommand {
  public constructor(config?: Partial<Commands.GithubCreatePullRequestCommandConfig>) {
    super(Object.assign({}, CMD_CONFIG, config));
  }
}

describe("create a github pull request", () => {
  const V3_MIME_TYPE = "application/vnd.github.v3+json";
  const CREATED_PR_ID = Date.now();
  const pullRequestNumber = 1;
  const pullRequestURL = `https://github.com/${CMD_CONFIG.owner}/${CMD_CONFIG.repo}/pull/${pullRequestNumber}`;
  const createPullRequestURL = `https://api.github.com/repos/${CMD_CONFIG.owner}/${CMD_CONFIG.repo}/pulls`;
  const updatePullRequestURL = `https://api.github.com/repos/${CMD_CONFIG.owner}/${CMD_CONFIG.repo}/pulls/${pullRequestNumber}`;

  beforeEach(() => {
    fetch.mockImplementation(async () => {
      const body = JSON.stringify({
        id: CREATED_PR_ID,
        html_url: `https://github.com/${CMD_CONFIG.owner}/${CMD_CONFIG.repo}/pull/1`,
        number: 1,
      });

      return new Response(body, {
        status: 201,
        statusText: "Created",
      });
    });
  });

  test("pull request is created", async () => {
    const gitTagCommandStub = new GithubCreatePullRequestCommandStub();

    await gitTagCommandStub.do();

    const [url, request] = fetch.mock.calls[0];

    request.body = JSON.parse(request.body);

    expect(url).toStrictEqual(createPullRequestURL);

    expect(request).toMatchObject({
      method: "POST",

      headers: {
        ...CMD_CONFIG.headers,
        Accept: V3_MIME_TYPE,
      },

      body: {
        base: CMD_CONFIG.base,
        head: CMD_CONFIG.head,
        body: CMD_CONFIG.body,
        title: CMD_CONFIG.title,
      },
    });

    expect(LOGGER.info).toHaveBeenCalledWith(`Created pull request: ${pullRequestURL} (id: ${CREATED_PR_ID})`);
  });

  test("undo closes pull request when it was created", async () => {
    const gitTagCommandStub = new GithubCreatePullRequestCommandStub();

    await gitTagCommandStub.do();

    fetch.mockClear().mockImplementation(async () => {
      return new Response("", {
        status: 200,
        statusText: "OK",
      });
    });

    await gitTagCommandStub.undo();

    const [url, request] = fetch.mock.calls[0];

    request.body = JSON.parse(request.body);

    expect(url).toStrictEqual(updatePullRequestURL);

    expect(request).toMatchObject({
      method: "PATCH",

      headers: {
        ...CMD_CONFIG.headers,
        Accept: V3_MIME_TYPE,
      },

      body: {
        state: "closed",
      },
    });

    expect(LOGGER.info).toHaveBeenCalledWith(`Closed pull request: ${pullRequestURL}`);
  });

  test("execution fails when response status code is not 201", async () => {
    const expectedStatusCode = 200;
    const gitTagCommandStub = new GithubCreatePullRequestCommandStub();

    fetch.mockClear().mockImplementation(async () => {
      return new Response("", {
        status: expectedStatusCode,
        statusText: "OK",
      });
    });

    const [error] = await to(gitTagCommandStub.do());

    expect(error).toEqual(new Error(`Failed to create pull request. Status code is ${expectedStatusCode}`));
  });

  test("undo logs a message when failing to close pull request", async () => {
    const gitTagCommandStub = new GithubCreatePullRequestCommandStub();

    await gitTagCommandStub.do();
    await gitTagCommandStub.undo();

    expect(LOGGER.warn).toBeCalledWith(`Failed to close pull request ${pullRequestURL}. Status code is 201`);
  });

  test("undo does not close pull request when it was not created", async () => {
    const gitTagCommandStub = new GithubCreatePullRequestCommandStub();

    fetch.mockClear().mockImplementation(async () => {
      return new Response("", {
        status: 200,
        statusText: "OK",
      });
    });

    await to(gitTagCommandStub.do());

    fetch.mockClear();

    await gitTagCommandStub.undo();

    expect(fetch).not.toHaveBeenCalled();
  });
});
