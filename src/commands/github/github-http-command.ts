import uriTemplates from 'uri-templates';
import type { RequestInit, RequestInfo, Response } from 'undici-types';

import { HttpCommand, HttpCommandConfig } from '../http-command.js';

const enum MimeTypes {
  V3 = 'application/vnd.github.v3+json',
}

const DEFAULT_HEADERS = {
  Accept: 'application/vnd.github.v3+json',
};

type GithubHttpCommandConfig = HttpCommandConfig;

abstract class GithubHttpCommand<T extends GithubHttpCommandConfig> extends HttpCommand<T> {
  public constructor(config: T) {
    super({
      ...config,
      headers: {
        ...DEFAULT_HEADERS,
        ...config.headers,
      },
    });
  }

  protected expendURL(url: string, parameters: Record<string, unknown>): string {
    return uriTemplates(url).fill(parameters);
  }

  protected async fetch(info: RequestInfo, init: RequestInit): Promise<Response> {
    const response = await super.fetch(info, init);

    if (!response.ok) {
      const tip = response.headers.get('X-Accepted-GitHub-Permissions');

      if (tip) {
        this.logger.warn(`GitHub Missing Permissions: ${tip}`);
      }
    }

    return response;
  }
}

export { MimeTypes, GithubHttpCommand, GithubHttpCommandConfig };
