import to from "await-to-js";
import uriTemplates from "uri-templates";
import { vitest, describe, test, expect, beforeEach } from "vitest";

import { Stubs } from "../stubs";
import { Commands } from "../../src";

const fetch = vitest.fn();

const LOGGER = new Stubs.LoggerStub();

const CMD_CONFIG: Commands.GithubCreateIssueCommentsCommandConfig = {
  logger: LOGGER,
  fetch,

  repoOwner: "nintendo",
  repoName: "super-mario",

  issueComments: [],

  headers: {
    "X-Custom-Header": "1",
  },
};

class GithubCommentOnIssuesCommandStub extends Commands.GithubCreateIssueCommentsCommand {
  public constructor(config?: Partial<Commands.GithubCreateIssueCommentsCommandConfig>) {
    super(Object.assign({}, CMD_CONFIG, config));
  }
}

describe("comment in github issues", () => {
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

  beforeEach(() => {
    fetch.mockImplementation(async (url: string) => {
      const { issueNumber } = URL_TEMPLATES.CREATE_COMMENT.fromUri(url);

      const resource = JSON.stringify({
        id: CREATED_COMMENT_ID,
        html_url: URL_TEMPLATES.CREATED_COMMENT_HTML.fill({ issueNumber }),
      });

      return new Response(resource, {
        status: 201,
        statusText: "Created",
      });
    });
  });

  test("comments are created", async () => {
    const issueComments = [
      { issueNumber: Date.now(), commentBody: "Test" },
      { issueNumber: Date.now(), commentBody: "Another test" },
    ];
    const commandStub = new GithubCommentOnIssuesCommandStub({
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

      expect(LOGGER.info).toBeCalledWith(`Created comment: ${resourceURL} (id: ${CREATED_COMMENT_ID})`);
    }
  });

  test("undo delete comments when one or more was created", async () => {
    const issueComments = [
      { issueNumber: Date.now(), commentBody: "Test" },
      { issueNumber: Date.now(), commentBody: "Another test" },
    ];
    const commandStub = new GithubCommentOnIssuesCommandStub({
      issueComments,
    });

    await commandStub.do();

    fetch.mockClear().mockImplementation(() => {
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

      expect(LOGGER.info).toBeCalledWith(`Deleted comment: ${resourceURL}`);
    }
  });

  test("undo logs a message when deleting a comment failed", async () => {
    const issueNumber = Date.now();
    const expectedStatus = {
      status: 404,
      statusText: "Not Found",
    };
    const commandStub = new GithubCommentOnIssuesCommandStub({
      issueComments: [{ issueNumber, commentBody: "Test" }],
    });

    await commandStub.do();

    fetch.mockClear().mockImplementation(() => {
      return new Response("", expectedStatus);
    });

    await commandStub.undo();

    const resourceURL = URL_TEMPLATES.CREATED_COMMENT_HTML.fill({ issueNumber });

    expect(LOGGER.warn).toBeCalledWith(
      `Failed to delete comment '${resourceURL}'. Status code is ${expectedStatus.status}`,
    );
  });

  test("execution does not fail when status code is 404/410", async () => {
    const issueNumber = Date.now();
    const statusArray = [
      { status: 410, statusText: "Gone" },
      { status: 404, statusText: "Not Found" },
    ];
    const commandStub = new GithubCommentOnIssuesCommandStub({
      issueComments: [{ issueNumber, commentBody: "Test" }],
    });

    fetch.mockClear();

    for (const status of statusArray) {
      fetch.mockImplementationOnce(() => {
        return new Response("", status);
      });

      const [error] = await to(commandStub.do());

      expect(error).toBeNull();
      expect(LOGGER.info).toBeCalledWith(`Could not find issue '${issueNumber}'. Comment was not created.`);

      LOGGER.info.mockReset();
    }
  });

  test("execution fails when status code is not 404/410/201", async () => {
    const issueNumber = Date.now();
    const statusCode = 422;
    const commandStub = new GithubCommentOnIssuesCommandStub({
      issueComments: [{ issueNumber, commentBody: "Test" }],
    });

    fetch.mockClear().mockImplementationOnce(() => {
      return new Response("", {
        status: statusCode,
        statusText: "Unprocessable Entity",
      });
    });

    const [error] = await to(commandStub.do());

    expect(error).toEqual(
      new Error(`Failed to create a comment in issue '${issueNumber}'. Status code is ${statusCode}`),
    );
  });
});
