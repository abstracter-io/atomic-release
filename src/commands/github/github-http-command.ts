import uriTemplates from "uri-templates";

import { HttpCommand, HttpCommandConfig } from "../http-command";

const enum MimeTypes {
  V3 = "application/vnd.github.v3+json",
}

const DEFAULT_HEADERS = {
  Accept: "application/vnd.github.v3+json",
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
}

export { MimeTypes, GithubHttpCommand, GithubHttpCommandConfig };
