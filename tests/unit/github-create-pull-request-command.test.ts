import { vitest, describe, test, expect } from 'vitest';

import { Stubs } from '../stubs.js';
import { Commands } from '../../src/index.js';

const CMD_CONFIG: Commands.GithubCreatePullRequestCommandConfig = {
  logger: Stubs.NoopLogger.INSTANCE,
  fetch,

  owner: 'nintendo',
  repo: 'super-mario',
  base: 'main',
  head: 'version-123-generated-files',
  title: '[Atomic Release] v123 generated files',
  body: 'This is sparta',

  headers: {
    'X-Custom-Header': '1',
  },
};
const V3_MIME_TYPE = 'application/vnd.github.v3+json';
const PR_NUMBER = 1;
const PR_URL = `https://github.com/${CMD_CONFIG.owner}/${CMD_CONFIG.repo}/pull/${PR_NUMBER}`;
const CREATE_PR_URL = `https://api.github.com/repos/${CMD_CONFIG.owner}/${CMD_CONFIG.repo}/pulls`;
const UPDATE_PR_URL = `https://api.github.com/repos/${CMD_CONFIG.owner}/${CMD_CONFIG.repo}/pulls/${PR_NUMBER}`;
const CREATED_PR_ID = Date.now();

class GithubCreatePullRequestCommandStub extends Commands.GithubCreatePullRequestCommand {
  public constructor(config?: Partial<Commands.GithubCreatePullRequestCommandConfig>) {
    super(Object.assign({}, CMD_CONFIG, config));
  }
}

const mockedFetch = () => vitest.fn(async () => {
  const body = JSON.stringify({
    id: CREATED_PR_ID,
    html_url: `https://github.com/${CMD_CONFIG.owner}/${CMD_CONFIG.repo}/pull/1`,
    number: 1,
  });

  return new Response(body, {
    status: 201,
    statusText: 'Created',
  });
});

describe('create a github pull request', () => {
  test('pull request is created', async () => {
    const fetch = mockedFetch();
    const logger = new Stubs.LoggerStub();
    const gitTagCommandStub = new GithubCreatePullRequestCommandStub({ logger, fetch });

    await gitTagCommandStub.do();

    expect(fetch).toBeCalledWith(CREATE_PR_URL, {
      method: 'POST',

      headers: {
        ...CMD_CONFIG.headers,
        Accept: V3_MIME_TYPE,
      },

      body: JSON.stringify({
        head: CMD_CONFIG.head,
        base: CMD_CONFIG.base,
        body: CMD_CONFIG.body,
        title: CMD_CONFIG.title,
      }),
    });

    expect(logger.info).toHaveBeenCalledWith(`Created pull request: ${PR_URL} (id: ${CREATED_PR_ID})`);
  });

  test('undo closes pull request when it was created', async () => {
    const fetch = mockedFetch();
    const logger = new Stubs.LoggerStub();
    const gitTagCommandStub = new GithubCreatePullRequestCommandStub({ logger, fetch });

    await gitTagCommandStub.do();

    fetch.mockImplementation(async () => {
      return new Response('', {
        status: 200,
        statusText: 'OK',
      });
    });

    await gitTagCommandStub.undo();

    expect(fetch).toBeCalledWith(UPDATE_PR_URL, {
      method: 'PATCH',

      headers: {
        ...CMD_CONFIG.headers,
        Accept: V3_MIME_TYPE,
      },

      body: JSON.stringify({
        state: 'closed',
      }),
    });

    expect(logger.info).toHaveBeenCalledWith(`Closed pull request: ${PR_URL}`);
  });

  test('execution fails when response status code is not 201', async () => {
    const fetch = mockedFetch();
    const expectedStatusCode = 200;
    const gitTagCommandStub = new GithubCreatePullRequestCommandStub({ fetch });
    const expectedError = new Error(`Failed to create pull request. Status code is ${expectedStatusCode}`);

    fetch.mockImplementation(async () => {
      return new Response('', {
        status: expectedStatusCode,
        statusText: 'OK',
      });
    });

    await expect(gitTagCommandStub.do()).rejects.toEqual(expectedError);
  });

  test('undo logs a message when failing to close pull request', async () => {
    const fetch = mockedFetch();
    const logger = new Stubs.LoggerStub();
    const gitTagCommandStub = new GithubCreatePullRequestCommandStub({ logger, fetch });

    await gitTagCommandStub.do();

    await gitTagCommandStub.undo();

    expect(logger.warn).toBeCalledWith(`Failed to close pull request ${PR_URL}. Status code is 201`);
  });

  test('undo does not close pull request when it was not created', async () => {
    const fetch = mockedFetch();
    const gitTagCommandStub = new GithubCreatePullRequestCommandStub({ fetch });

    fetch.mockImplementation(async () => {
      return new Response('', {
        status: 403,
        statusText: 'FORBIDDEN',
      });
    });

    await gitTagCommandStub.do().catch(e => e);

    fetch.mockClear();

    await gitTagCommandStub.undo();

    expect(fetch).not.toHaveBeenCalled();
  });
});
