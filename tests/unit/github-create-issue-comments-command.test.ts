import to from "await-to-js";
import uriTemplates from "uri-templates";
import { vitest, describe, test, expect } from "vitest";

import { Stubs } from "../stubs";
import { Commands } from "../../src";

const mockedFetch = () => {
  return vitest.fn(async (url: string) => {
    const { issueNumber } = URL_TEMPLATES.CREATE_COMMENT.fromUri(url);

    const resource = JSON.stringify({
      id: CREATED_COMMENT_ID,
      html_url: URL_TEMPLATES.CREATED_COMMENT_HTML.fill({ issueNumber }),
    });

    return new Response(resource, {
      status: 201,
      statusText: "Created",
    });
  })
};

const CMD_CONFIG: Commands.GithubCreateIssueCommentsCommandConfig = {
  logger: Stubs.NoopLogger.INSTANCE,
  fetch: mockedFetch(),

  repoOwner: "nintendo",
  repoName: "super-mario",

  issueComments: [],

  headers: {
    "X-Custom-Header": "1",
  },
};

const V3_MIME_TYPE = "application/vnd.github.v3+json";

const CREATED_COMMENT_ID = Date.now();

const URL_TEMPLATES = {
  CREATE_COMMENT: uriTemplates(
    `https://api.github.com/repos/${CMD_CONFIG.repoOwner}/${CMD_CONFIG.repoName}/issues/{issueNumber}/comments`,
  ),

  CREATED_COMMENT_HTML: uriTemplates(
    `https://github.com/${CMD_CONFIG.repoOwner}/${CMD_CONFIG.repoName}/pull/{issueNumber}#issuecomment-${CREATED_COMMENT_ID}`,
  ),

  // Cutting corners... not really a template
  DELETE_COMMENT: `https://api.github.com/repos/${CMD_CONFIG.repoOwner}/${CMD_CONFIG.repoName}/issues/comments/${CREATED_COMMENT_ID}`,
};

class GithubCommentOnIssuesCommandStub extends Commands.GithubCreateIssueCommentsCommand {
  public constructor(config?: Partial<Commands.GithubCreateIssueCommentsCommandConfig>) {
    super(Object.assign({}, CMD_CONFIG, config));
  }
}

describe("comment in github issues", () => {
  test("comments are created", async () => {
    const fetch = mockedFetch();
    const logger = new Stubs.LoggerStub();
    const issueComments = [
      { issueNumber: Date.now(), commentBody: "Test" },
      { issueNumber: Date.now(), commentBody: "Another test" },
    ];
    const commandStub = new GithubCommentOnIssuesCommandStub({
      fetch,
      logger,
      issueComments,
    });

    await commandStub.do();

    for (const issueComment of issueComments) {
      const expectedURL = URL_TEMPLATES.CREATE_COMMENT.fill({
        repo: CMD_CONFIG.repoName,
        owner: CMD_CONFIG.repoOwner,
        issueNumber: issueComment.issueNumber,
      });
      const resourceURL = URL_TEMPLATES.CREATED_COMMENT_HTML.fill({
        issueNumber: issueComment.issueNumber,
      });

      expect(fetch).toBeCalledWith(expectedURL, {
        method: "POST",

        headers: {
          ...CMD_CONFIG.headers,
          "Content-Type": "application/json",
          "Accept": V3_MIME_TYPE,
        },

        body: expect.stringMatching(JSON.stringify({
          body: issueComment.commentBody,
        })),
      });

      expect(logger.info).toBeCalledWith(`Created comment: ${resourceURL} (id: ${CREATED_COMMENT_ID})`);
    }
  });

  test("undo delete comments when one or more was created", async () => {
    const fetch = mockedFetch();
    const logger = new Stubs.LoggerStub();
    const issueComments = [
      { issueNumber: Date.now(), commentBody: "Test" },
      { issueNumber: Date.now(), commentBody: "Another test" },
    ];
    const commandStub = new GithubCommentOnIssuesCommandStub({
      fetch,
      logger,
      issueComments,
    });

    await commandStub.do();

    fetch.mockImplementation(async () => {
      return new Response(null, {
        status: 204,
        statusText: "No Content",
      });
    });

    await commandStub.undo();

    for (const issueComment of issueComments) {
      const resourceURL = URL_TEMPLATES.CREATED_COMMENT_HTML.fill({
        issueNumber: issueComment.issueNumber,
      });

      expect(fetch).toBeCalledWith(URL_TEMPLATES.DELETE_COMMENT, {
        method: "DELETE",

        headers: {
          ...CMD_CONFIG.headers,
          Accept: V3_MIME_TYPE,
        },
      });

      expect(logger.info).toBeCalledWith(`Deleted comment: ${resourceURL}`);
    }
  });

  test("undo logs a message when deleting a comment failed", async () => {
    const fetch = mockedFetch();
    const logger = new Stubs.LoggerStub();
    const issueNumber = Date.now();
    const expectedStatus = {
      status: 404,
      statusText: "Not Found",
    };
    const commandStub = new GithubCommentOnIssuesCommandStub({
      fetch,
      logger,
      issueComments: [{ issueNumber, commentBody: "Test" }],
    });

    await commandStub.do();

    fetch.mockImplementation(async () => {
      return new Response("", expectedStatus);
    });

    await commandStub.undo();

    const resourceURL = URL_TEMPLATES.CREATED_COMMENT_HTML.fill({ issueNumber });

    expect(logger.warn).toBeCalledWith(
      `Failed to delete comment '${resourceURL}'. Status code is ${expectedStatus.status}`,
    );
  });

  test("execution does not fail when status code is 404/410", async () => {
    const fetch = mockedFetch();
    const logger = new Stubs.LoggerStub();
    const issueNumber = Date.now();
    const statusArray = [
      { status: 410, statusText: "Gone" },
      { status: 404, statusText: "Not Found" },
    ];
    const commandStub = new GithubCommentOnIssuesCommandStub({
      fetch,
      logger,
      issueComments: [{ issueNumber, commentBody: "Test" }],
    });

    for (const status of statusArray) {
      fetch.mockImplementationOnce(async () => {
        return new Response("", status);
      });

      const [error] = await to(commandStub.do());

      expect(error).toBeNull();
      expect(logger.info).toBeCalledWith(`Could not find issue '${issueNumber}'. Comment was not created.`);

      logger.info.mockReset();
    }
  });

  test("execution fails when status code is not 404/410/201", async () => {
    const fetch = mockedFetch();
    const logger = new Stubs.LoggerStub();
    const statusCode = 422;
    const issueNumber = Date.now();
    const commandStub = new GithubCommentOnIssuesCommandStub({
      fetch,
      logger,
      issueComments: [{ issueNumber, commentBody: "Test" }],
    });
    const expectedError = new Error(`Failed to create a comment in issue '${issueNumber}'. Status code is ${statusCode}`);

    fetch.mockImplementationOnce(async () => {
      return new Response("", {
        status: statusCode,
        statusText: "Unprocessable Entity",
      });
    });

    await expect(commandStub.do()).rejects.toEqual(expectedError);
  });
});
