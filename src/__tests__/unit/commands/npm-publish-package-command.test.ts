import fs from "fs";
import to from "await-to-js";

import { spiedLogger } from "../../stubs/spied-logger";
import { NpmPublishPackageCommand } from "../../../commands";
import type { NpmPublishPackageCommandOptions } from "../../../commands";

const execute = jest.fn();
const logger = spiedLogger();

jest.mock("execa", () => {
  return async (...args) => {
    return execute(...args);
  };
});

class NpmPublishPackageCommandStub extends NpmPublishPackageCommand {
  public static readonly DEFAULT_OPTIONS: NpmPublishPackageCommandOptions = {
    logger,

    workingDirectory: "/fake/path",
  };

  public constructor(options?: Partial<NpmPublishPackageCommandOptions>) {
    super(Object.assign({}, NpmPublishPackageCommandStub.DEFAULT_OPTIONS, options));
  }
}

describe("publish npm package", () => {
  let readFile;

  const expected = NpmPublishPackageCommandStub.DEFAULT_OPTIONS;

  const PACKAGE_NAME = "test";
  const PACKAGE_VERSION = "0.1.0";
  const PACKAGE_NAME_AND_VERSION = `${PACKAGE_NAME}@${PACKAGE_VERSION}`;

  beforeEach(() => {
    readFile = jest.spyOn(fs.promises, "readFile");

    readFile.mockImplementationOnce(async () => {
      return JSON.stringify({
        private: false,
        name: PACKAGE_NAME,
        version: PACKAGE_VERSION,
      });
    });

    execute.mockImplementation(async () => {
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

    expect(logger.info).toBeCalledWith(`Publishing '${PACKAGE_NAME_AND_VERSION}' using dist tag '${expectedTag}'`);

    expect(execute).toBeCalledWith("npm", ["publish", "--tag", expectedTag], {
      cwd: expected.workingDirectory,
    });
  });

  test("publishing to a specified registry", async () => {
    const expectedRegistry = "https://npm.local.registry";
    const commandStub = new NpmPublishPackageCommandStub({
      registry: expectedRegistry,
    });

    await commandStub.do();

    expect(logger.info).toBeCalledWith(`Publishing '${PACKAGE_NAME_AND_VERSION}' to registry '${expectedRegistry}'`);

    expect(execute).toBeCalledWith("npm", ["publish", "--registry", expectedRegistry], {
      cwd: expected.workingDirectory,
    });
  });

  test("publishing is skipped when package is private", async () => {
    const commandStub = new NpmPublishPackageCommandStub();

    readFile.mockReset().mockImplementation(async () => {
      return JSON.stringify({
        name: PACKAGE_NAME,
        private: true,
      });
    });

    await commandStub.do();

    expect(execute).not.toBeCalled();

    expect(logger.info).toBeCalledWith(`Skipping publish. Package '${PACKAGE_NAME}' private property is true.`);
  });

  test("undo does not unpublish when package was not published", async () => {
    const expectedError = new Error("Some failure");
    const commandStub = new NpmPublishPackageCommandStub();

    execute.mockClear().mockImplementationOnce(async () => {
      throw expectedError;
    });

    const [error] = await to(commandStub.do());
    await commandStub.undo();

    expect(error).toEqual(error);
    expect(execute).not.toBeCalledWith("npm", ["unpublish"], {
      cwd: expected.workingDirectory,
    });
  });

  test("undo does not unpublish when 'undoPublish' is not true", async () => {
    const commandStub = new NpmPublishPackageCommandStub();

    await commandStub.do();
    await commandStub.undo();

    expect(execute).not.toBeCalledWith("npm", ["unpublish"], {
      cwd: expected.workingDirectory,
    });
  });

  test("undo unpublish when package was published and 'undoPublish' is true", async () => {
    const commandStub = new NpmPublishPackageCommandStub({
      undoPublish: true,
    });

    await commandStub.do();
    await commandStub.undo();

    expect(execute).toBeCalledWith("npm", ["unpublish", PACKAGE_NAME_AND_VERSION], {
      cwd: expected.workingDirectory,
    });
  });
});
