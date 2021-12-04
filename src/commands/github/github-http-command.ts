import uriTemplates from "uri-templates";

import { HttpCommand, HttpCommandOptions } from "../http-command";

const enum MimeTypes {
  V3 = "application/vnd.github.v3+json",
}

const DEFAULT_HEADERS = {
  Accept: "application/vnd.github.v3+json",
};

type GithubHttpCommandOptions = HttpCommandOptions;

abstract class GithubHttpCommand<T extends GithubHttpCommandOptions> extends HttpCommand<T> {
  protected constructor(options: T) {
    super({
      ...options,
      headers: {
        ...DEFAULT_HEADERS,
        ...options.headers,
      },
    });
  }

  protected expendURL(url: string, parameters: Record<string, unknown>): string {
    return uriTemplates(url).fill(parameters);
  }
}

export { MimeTypes, GithubHttpCommand, GithubHttpCommandOptions };
