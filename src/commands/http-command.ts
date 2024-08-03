import fetchDefaults from 'fetch-defaults';
import type { RequestInit, RequestInfo, Response } from 'undici-types';

import { Command, CommandConfig } from '../sdk/command.js';

type Fetch = typeof fetch;

type HttpCommandConfig = CommandConfig & {
  fetch?: Fetch;
  headers?: Record<string, string>;
};

abstract class HttpCommand<T extends HttpCommandConfig> extends Command<T> {
  private readonly _fetch: Fetch;

  protected constructor(config: T) {
    super(config);

    this._fetch = fetchDefaults(config.fetch ?? fetch, {
      headers: {
        ...config.headers,
      },
    });
  }

  protected fetch(input: RequestInfo, init: RequestInit): Promise<Response> {
    return this._fetch(input, init);
  }
}

export { HttpCommand, HttpCommandConfig };
