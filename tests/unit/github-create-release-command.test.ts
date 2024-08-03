import fs from 'node:fs';
import path from 'node:path';
import to from 'await-to-js';
import { Readable } from 'node:stream';
import uriTemplate from 'uri-templates';
import { vitest, test, expect, describe, beforeEach } from 'vitest';

import { Stubs } from '../stubs';
import { Commands } from '../../src';

const fetch = vitest.fn();

const LOGGER = new Stubs.LoggerStub();

const CMD_CONFIG: Commands.GithubCreateReleaseCommandConfig = {
  logger: LOGGER,
  fetch,

  owner: 'nintendo',
  repo: 'super-mario',

  tagName: 'v123',
  name: 'v123',
  body: 'This is sparta',

  headers: {
    'X-Custom-Header': '1',
  },
};

class GithubCreateReleaseCommandStub extends Commands.GithubCreateReleaseCommand {
  public constructor(config?: Partial<Commands.GithubCreateReleaseCommandConfig>) {
    super(Object.assign({}, CMD_CONFIG, config));
  }
}

describe('github create release command', () => {
  const CREATED_RELEASE_ID = Date.now();
  const V3_MIME_TYPE = 'application/vnd.github.v3+json';
  const URLS = {
    CREATE_RELEASE: `https://api.github.com/repos/${CMD_CONFIG.owner}/${CMD_CONFIG.repo}/releases`,

    DELETE_RELEASE: `https://api.github.com/repos/${CMD_CONFIG.owner}/${CMD_CONFIG.repo}/releases/${CREATED_RELEASE_ID}`,

    RELEASE_HTML: `https://github.com/${CMD_CONFIG.owner}/${CMD_CONFIG.repo}/releases/tag/${CMD_CONFIG.tagName}`,

    RELEASE_RESOURCE: `https://api.github.com/repos/${CMD_CONFIG.owner}/${CMD_CONFIG.repo}/releases/${CREATED_RELEASE_ID}`,

    UPLOAD: `https://uploads.github.com/repos/${CMD_CONFIG.owner}/${CMD_CONFIG.repo}/releases/${CREATED_RELEASE_ID}/assets{?name,label}`,
  };

  beforeEach(() => {
    fetch.mockImplementation(async (url: string) => {
      const body = JSON.stringify({
        url: URLS.RELEASE_RESOURCE,
        upload_url: URLS.UPLOAD,
        html_url: URLS.RELEASE_HTML,
        id: CREATED_RELEASE_ID,
      });

      const status = {
        status: 201,
        statusText: 'Created',
      };

      if (url === URLS.RELEASE_RESOURCE) {
        status.status = 200;
        status.statusText = 'OK';
      }

      return new Response(body, status);
    });
  });

  test('asset is uploaded with a label', async () => {
    const asset = { absoluteFilePath: __filename, label: 'LABEL' };
    const expectedURL = uriTemplate(URLS.UPLOAD).fill({
      name: path.basename(__filename),
      label: asset.label,
    });
    const gitCommandStub = new GithubCreateReleaseCommandStub({
      assets: [asset],
    });
    const expectedRequest = {
      method: 'POST',

      headers: {
        'X-Custom-Header': '1',
        'Content-Type': 'video/mp2t',
        'Content-Length': fs.statSync(__filename).size.toString(),
        'Accept': V3_MIME_TYPE,
      },

      body: expect.any(Readable),
    };

    await gitCommandStub.do();

    expect(fetch).toBeCalledWith(expectedURL, expect.objectContaining(expectedRequest));
  });

  test('release is created as pre release', async () => {
    const gitCommandStub = new GithubCreateReleaseCommandStub();

    await gitCommandStub.do();

    expect(LOGGER.info).toBeCalledWith(`Created release: ${URLS.RELEASE_HTML} (id: ${CREATED_RELEASE_ID})`);

    expect(fetch).toBeCalledWith(URLS.CREATE_RELEASE, {
      method: 'POST',

      headers: {
        ...CMD_CONFIG.headers,
        'Accept': V3_MIME_TYPE,
        'Content-Type': 'application/json',
      },

      body: expect.stringMatching(JSON.stringify({
        tag_name: CMD_CONFIG.tagName,
        name: CMD_CONFIG.name,
        body: CMD_CONFIG.body,
        draft: false,
        prerelease: true,
      })),
    });
  });

  test('release is not created as pre release', async () => {
    const gitCommandStub = new GithubCreateReleaseCommandStub({
      isStable: true,
    });

    await gitCommandStub.do();

    expect(LOGGER.info).toBeCalledWith(`Created release: ${URLS.RELEASE_HTML} (id: ${CREATED_RELEASE_ID})`);

    expect(fetch).toBeCalledWith(URLS.CREATE_RELEASE, {
      method: 'POST',

      headers: {
        ...CMD_CONFIG.headers,
        'Accept': V3_MIME_TYPE,
        'Content-Type': 'application/json',
      },

      body: expect.stringMatching(JSON.stringify({
        tag_name: CMD_CONFIG.tagName,
        name: CMD_CONFIG.name,
        body: CMD_CONFIG.body,
        draft: false,
        prerelease: false,
      })),
    });
  });

  test('undo deletes release when it was created', async () => {
    const gitCommandStub = new GithubCreateReleaseCommandStub();

    await gitCommandStub.do();

    fetch.mockClear().mockImplementation(async () => {
      return new Response(null, {
        status: 204,
        statusText: 'No Content',
      });
    });

    await gitCommandStub.undo();

    expect(LOGGER.info).toBeCalledWith(`Deleted release: ${URLS.RELEASE_HTML}`);

    expect(fetch).toBeCalledWith(URLS.DELETE_RELEASE, {
      method: 'DELETE',

      headers: {
        ...CMD_CONFIG.headers,
        Accept: V3_MIME_TYPE,
      },
    });
  });

  test('assets with the same name are uploaded once', async () => {
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

    expect(LOGGER.warn).toBeCalledWith('Duplicate asset will be filtered out');
    expect(LOGGER.warn).toBeCalledWith(`An asset named '${path.basename(__filename)}' already exists`);
  });

  test('execution fails when response status code is not 201', async () => {
    const expectedStatusCode = 200;
    const gitCommandStub = new GithubCreateReleaseCommandStub();

    fetch.mockClear().mockImplementation(async () => {
      return new Response('', {
        status: expectedStatusCode,
        statusText: 'OK',
      });
    });

    const [error] = await to(gitCommandStub.do());

    expect(error).toEqual(new Error(`Failed to create release. Status code is ${expectedStatusCode}`));
  });

  test('undo does not delete release when it was not created', async () => {
    const gitCommandStub = new GithubCreateReleaseCommandStub();

    fetch.mockClear().mockImplementation(async () => {
      return new Response('', {
        status: 403,
        statusText: 'OK',
      });
    });

    await to(gitCommandStub.do());

    fetch.mockClear();

    await gitCommandStub.undo();

    expect(fetch).not.toHaveBeenCalled();
  });

  test('undo logs a message when failing to close pull request', async () => {
    const gitCommandStub = new GithubCreateReleaseCommandStub();

    await gitCommandStub.do();
    await gitCommandStub.undo();

    expect(LOGGER.warn).toBeCalledWith(`Failed to delete release '${URLS.RELEASE_HTML}'. Status code is 200`);
  });

  test('release is created in draft mode when there are assets', async () => {
    const gitCommandStub = new GithubCreateReleaseCommandStub({
      assets: [{ absoluteFilePath: __filename, label: 'LABEL' }],
    });

    await gitCommandStub.do();

    expect(fetch).toBeCalledWith(URLS.CREATE_RELEASE, {
      method: 'POST',

      headers: {
        ...CMD_CONFIG.headers,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },

      body: expect.stringMatching(JSON.stringify({
        tag_name: CMD_CONFIG.tagName,
        name: CMD_CONFIG.name,
        body: CMD_CONFIG.body,
        draft: true,
        prerelease: true,
      })),
    });
  });

  test('release is taken out of draft mode (published) when uploading assets completes', async () => {
    const gitCommandStub = new GithubCreateReleaseCommandStub({
      assets: [{ absoluteFilePath: __filename }],
    });

    await gitCommandStub.do();

    expect(fetch).toBeCalledWith(URLS.RELEASE_RESOURCE, {
      method: 'POST',

      headers: {
        ...CMD_CONFIG.headers,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },

      body: expect.stringMatching(JSON.stringify({
        draft: false,
      })),
    });
  });
});
