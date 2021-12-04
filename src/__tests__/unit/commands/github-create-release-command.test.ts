import path from "path";
import to from "await-to-js";
import fs, { ReadStream } from "fs";
import { Response } from "node-fetch";
import uriTemplate from "uri-templates";

import { spiedLogger } from "../../stubs/spied-logger";
import { GithubCreateReleaseCommand } from "../../../commands";
import type { GithubCreateReleaseCommandOptions } from "../../../commands";

const fetch = jest.fn();
const logger = spiedLogger();

class GithubCreateReleaseCommandStub extends GithubCreateReleaseCommand {
  public static readonly DEFAULT_OPTIONS: GithubCreateReleaseCommandOptions = {
    logger,
    fetch,

    owner: "nintendo",
    repo: "super-mario",

    tagName: "v123",
    name: "v123",
    body: "This is sparta",

    headers: {
      "X-Custom-Header": "1",
    },
  };

  public constructor(options?: Partial<GithubCreateReleaseCommandOptions>) {
    super(Object.assign({}, GithubCreateReleaseCommandStub.DEFAULT_OPTIONS, options));
  }
}

describe("github create release command", () => {
  const expected = GithubCreateReleaseCommandStub.DEFAULT_OPTIONS;

  const tagName = expected.tagName;

  const createdReleaseId = Date.now();

  const V3_MIME_TYPE = "application/vnd.github.v3+json";

  const URLS = {
    CREATE_RELEASE: `https://api.github.com/repos/${expected.owner}/${expected.repo}/releases`,

    DELETE_RELEASE: `https://api.github.com/repos/${expected.owner}/${expected.repo}/releases/${createdReleaseId}`,

    RELEASE_HTML: `https://github.com/${expected.owner}/${expected.repo}/releases/tag/${tagName}`,

    RELEASE_RESOURCE: `https://api.github.com/repos/${expected.owner}/${expected.repo}/releases/${createdReleaseId}`,

    UPLOAD: `https://uploads.github.com/repos/${expected.owner}/${expected.repo}/releases/${createdReleaseId}/assets{?name,label}`,
  };

  beforeEach(() => {
    fetch.mockImplementation(async (url: string) => {
      const body = JSON.stringify({
        url: URLS.RELEASE_RESOURCE,
        upload_url: URLS.UPLOAD,
        html_url: URLS.RELEASE_HTML,
        id: createdReleaseId,
      });

      const status = {
        status: 201,
        statusText: "Created",
      };

      if (url === URLS.RELEASE_RESOURCE) {
        status.status = 200;
        status.statusText = "OK";
      }

      return new Response(body, status);
    });
  });

  test("release is created as pre release", async () => {
    const gitCommandStub = new GithubCreateReleaseCommandStub();

    await gitCommandStub.do();

    expect(logger.info).toBeCalledWith(`Created release: ${URLS.RELEASE_HTML} (id: ${createdReleaseId})`);

    expect(fetch).toBeCalledWith(URLS.CREATE_RELEASE, {
      method: "POST",

      headers: {
        ...expected.headers,
        Accept: V3_MIME_TYPE,
        "Content-Type": "application/json",
      },

      body: expect.jsonMatching({
        tag_name: expected.tagName,
        body: expected.body,
        name: expected.name,
        draft: false,
        prerelease: true,
      }),
    });
  });

  test("release is not created as pre release", async () => {
    const gitCommandStub = new GithubCreateReleaseCommandStub({
      isStable: true,
    });

    await gitCommandStub.do();

    expect(logger.info).toBeCalledWith(`Created release: ${URLS.RELEASE_HTML} (id: ${createdReleaseId})`);

    expect(fetch).toBeCalledWith(URLS.CREATE_RELEASE, {
      method: "POST",

      headers: {
        ...expected.headers,
        Accept: V3_MIME_TYPE,
        "Content-Type": "application/json",
      },

      body: expect.jsonMatching({
        tag_name: expected.tagName,
        body: expected.body,
        name: expected.name,
        draft: false,
        prerelease: false,
      }),
    });
  });

  test("asset is uploaded with a label", async () => {
    const asset = { absoluteFilePath: __filename, label: "LABEL" };
    const expectedURL = uriTemplate(URLS.UPLOAD).fill({
      name: path.basename(__filename),
      label: asset.label,
    });
    const gitCommandStub = new GithubCreateReleaseCommandStub({
      assets: [asset],
    });
    const expectedRequest = {
      method: "POST",

      headers: {
        "X-Custom-Header": "1",
        "Content-Type": expect.any(String),
        "Content-Length": fs.statSync(__filename).size.toString(),
        Accept: V3_MIME_TYPE,
      },

      body: expect.any(ReadStream),
    };

    await gitCommandStub.do();

    expect(fetch).toBeCalledWith(expectedURL, expect.objectContaining(expectedRequest));
  });

  test("undo deletes release when it was created", async () => {
    const gitCommandStub = new GithubCreateReleaseCommandStub();

    await gitCommandStub.do();

    fetch.mockClear().mockImplementation(async () => {
      return new Response("", {
        status: 204,
        statusText: "No Content",
      });
    });

    await gitCommandStub.undo();

    expect(logger.info).toBeCalledWith(`Deleted release: ${URLS.RELEASE_HTML}`);

    expect(fetch).toBeCalledWith(URLS.DELETE_RELEASE, {
      method: "DELETE",

      headers: {
        ...expected.headers,
        Accept: V3_MIME_TYPE,
      },
    });
  });

  test("assets with the same name are uploaded once", async () => {
    const asset = { absoluteFilePath: __filename };
    const expectedURL = uriTemplate(URLS.UPLOAD).fill({
      name: path.basename(__filename),
    });
    const gitCommandStub = new GithubCreateReleaseCommandStub({
      assets: [asset, asset],
    });

    await gitCommandStub.do();

    const uploads = fetch.mock.calls.filter((parameters) => {
      return parameters[0] === expectedURL;
    });

    expect(uploads.length).toEqual(1);

    expect(logger.warn).toBeCalledWith(`Duplicate asset will be filtered out`);
    expect(logger.warn).toBeCalledWith(`An asset named '${path.basename(__filename)}' already exists`);
  });

  test("execution fails when response status code is not 201", async () => {
    const expectedStatusCode = 200;
    const gitCommandStub = new GithubCreateReleaseCommandStub();

    fetch.mockClear().mockImplementation(async () => {
      return new Response("", {
        status: expectedStatusCode,
        statusText: "OK",
      });
    });

    const [error] = await to(gitCommandStub.do());

    expect(error).toEqual(new Error(`Failed to create release. Status code is ${expectedStatusCode}`));
  });

  test("undo does not delete release when it was not created", async () => {
    const gitCommandStub = new GithubCreateReleaseCommandStub();

    fetch.mockClear().mockImplementation(async () => {
      return new Response("", {
        status: 403,
        statusText: "OK",
      });
    });

    await to(gitCommandStub.do());

    fetch.mockClear();

    await gitCommandStub.undo();

    expect(fetch).not.toHaveBeenCalled();
  });

  test("undo logs a message when failing to close pull request", async () => {
    const gitCommandStub = new GithubCreateReleaseCommandStub();

    await gitCommandStub.do();
    await gitCommandStub.undo();

    expect(logger.warn).toBeCalledWith(`Failed to delete release '${URLS.RELEASE_HTML}'. Status code is 200`);
  });

  test("release is created in draft mode when there are assets", async () => {
    const gitCommandStub = new GithubCreateReleaseCommandStub({
      assets: [{ absoluteFilePath: __filename, label: "LABEL" }],
    });

    await gitCommandStub.do();

    expect(fetch).toBeCalledWith(URLS.CREATE_RELEASE, {
      method: "POST",

      headers: {
        ...expected.headers,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },

      body: expect.jsonMatching({
        tag_name: expected.tagName,
        name: expected.name,
        body: expected.body,
        draft: true,
        prerelease: true,
      }),
    });
  });

  test("release is taken out of draft mode (published) when uploading assets completes", async () => {
    const gitCommandStub = new GithubCreateReleaseCommandStub({
      assets: [{ absoluteFilePath: __filename }],
    });

    await gitCommandStub.do();

    expect(fetch).toBeCalledWith(URLS.RELEASE_RESOURCE, {
      method: "POST",

      headers: {
        ...expected.headers,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },

      body: expect.jsonMatching({
        draft: false,
      }),
    });
  });
});
