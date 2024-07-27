import to from "await-to-js";
import { vitest, describe, test, expect, beforeEach } from "vitest";

import { Stubs } from "../stubs";
import { Commands } from "../../src";

const execa = vitest.fn();

const LOGGER = new Stubs.LoggerStub();

const PACKAGE_JSON = {
  private: false,
  name: 'test',
  version: '0.1.0',
};

const CMD_CONFIG: Commands.NpmPublishPackageCommandConfig = {
  logger: LOGGER,

  workingDirectory: "/fake/path",
};

vitest.mock("execa", () => {
  return {
    default: async (...args) => {
      return execa(...args);
    }
  };
});

class NpmPublishPackageCommandStub extends Commands.NpmPublishPackageCommand {
  public constructor(config?: Partial<Commands.NpmPublishPackageCommandConfig>) {
    super(Object.assign({}, CMD_CONFIG, config));
  }

  getPackageJson = vitest.fn(async () => {
    return PACKAGE_JSON
  })
}

describe("publish npm package", () => {
  const PACKAGE_NAME_AND_VERSION = `${PACKAGE_JSON.name}@${PACKAGE_JSON.version}`;

  beforeEach(() => {
    execa.mockClear().mockImplementation(async () => {
      return {
        exitCode: 0,
        stdout: "",
        stderr: "",
      };
    });
  });

  test("publishing to a specified dist tag", async () => {
    const expectedTag = "beta";
    const commandStub = new NpmPublishPackageCommandStub({
      tag: expectedTag,
    });

    await commandStub.do();

    expect(LOGGER.info).toBeCalledWith(`Publishing '${PACKAGE_NAME_AND_VERSION}' using dist tag '${expectedTag}'`);

    expect(execa).toBeCalledWith("npm", ["publish", "--tag", expectedTag], {
      cwd: CMD_CONFIG.workingDirectory,
    });
  });

  test("publishing to a specified registry", async () => {
    const expectedRegistry = "https://npm.local.registry";
    const commandStub = new NpmPublishPackageCommandStub({
      registry: expectedRegistry,
    });

    await commandStub.do();

    expect(LOGGER.info).toBeCalledWith(`Publishing '${PACKAGE_NAME_AND_VERSION}' to registry '${expectedRegistry}'`);

    expect(execa).toBeCalledWith("npm", ["publish", "--registry", expectedRegistry], {
      cwd: CMD_CONFIG.workingDirectory,
    });
  });

  test("publishing is skipped when package is private", async () => {
    const commandStub = new NpmPublishPackageCommandStub();

    commandStub.getPackageJson.mockImplementation(async () => {
      return {
        ...PACKAGE_JSON,
        private: true,
      }
    })

    await commandStub.do();

    expect(execa).not.toBeCalled();

    expect(LOGGER.info).toBeCalledWith(`Skipping publish. Package '${PACKAGE_JSON.name}' private property is true.`);
  });

  test("undo does not unpublish when package was not published", async () => {
    const expectedError = new Error("Some failure");
    const commandStub = new NpmPublishPackageCommandStub();

    execa.mockClear().mockImplementationOnce(async () => {
      throw expectedError;
    });

    const [error] = await to(commandStub.do());
    await commandStub.undo();

    expect(error).toEqual(error);
    expect(execa).not.toBeCalledWith("npm", ["unpublish"], {
      cwd: CMD_CONFIG.workingDirectory,
    });
  });

  test("undo does not unpublish when 'undoPublish' is not true", async () => {
    const commandStub = new NpmPublishPackageCommandStub();

    await commandStub.do();
    await commandStub.undo();

    expect(execa).not.toBeCalledWith("npm", ["unpublish"], {
      cwd: CMD_CONFIG.workingDirectory,
    });
  });

  test("undo unpublish when package was published and 'undoPublish' is true", async () => {
    const commandStub = new NpmPublishPackageCommandStub({
      undoPublish: true,
    });

    await commandStub.do();

    await commandStub.undo();

    expect(execa).toBeCalledWith("npm", ["unpublish", PACKAGE_NAME_AND_VERSION], {
      cwd: CMD_CONFIG.workingDirectory,
    });
  });
});
