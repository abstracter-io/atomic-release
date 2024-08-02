import fetchDefaults from "fetch-defaults";

import { Command, CommandConfig } from "../sdk/command.js";

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

  protected fetch: Fetch = async (input, init) => {
    return this._fetch(input, init);
  }
}

export { HttpCommand, HttpCommandConfig };
