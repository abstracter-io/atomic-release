import fetchDefaults from "fetch-defaults";
import fetch, { Response, RequestInfo, RequestInit } from "node-fetch";

import { Command, CommandOptions } from "../";

type Fetch = typeof fetch;

type HttpCommandOptions = CommandOptions & {
  headers?: Record<string, string>;
  fetch?: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
};

abstract class HttpCommand<T extends HttpCommandOptions> extends Command<T> {
  private readonly _fetch: Fetch;

  protected constructor(options: T) {
    super(options);

    this._fetch = fetchDefaults(options.fetch ?? fetch, {
      headers: {
        ...options.headers,
      },
    });
  }

  protected async fetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
    return this._fetch(input, init);
  }
}

export { HttpCommand, HttpCommandOptions };
