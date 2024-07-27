import fetchDefaults from "fetch-defaults";

import { Command, CommandConfig } from "../sdk/command";

type Fetch = typeof fetch;

type HttpCommandConfig = CommandConfig & {
  headers?: Record<string, string>;
  fetch?: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
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

  protected async fetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
    return this._fetch(input, init);
  }
}

export { HttpCommand, HttpCommandConfig };
