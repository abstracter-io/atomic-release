import fs from "fs";
import to from "await-to-js";

import { spiedLogger } from "../../stubs/spied-logger";
import { NpmBumpPackageVersionCommand } from "../../../commands";
import type { NpmBumpPackageVersionCommandOptions } from "../../../commands";

const execute = jest.fn();
const logger = spiedLogger();

jest.mock("execa", () => {
  return async (...args) => {
    return execute(...args);
  };
});

class NpmBumpPackageVersionCommandStub extends NpmBumpPackageVersionCommand {
  public static readonly DEFAULT_OPTIONS: NpmBumpPackageVersionCommandOptions = {
    logger,

    version: "0.2.0",

    workingDirectory: "/fake/path",
  };

  public constructor(options?: Partial<NpmBumpPackageVersionCommandOptions>) {
    super(Object.assign({}, NpmBumpPackageVersionCommandStub.DEFAULT_OPTIONS, options));
  }
}

describe("bumping package.json version", () => {
  let readFile;

  const expected = NpmBumpPackageVersionCommandStub.DEFAULT_OPTIONS;

  const PACKAGE_NAME = "test";
  const PACKAGE_VERSION = "0.1.0";
  const PACKAGE_JSON_PATH = `${expected.workingDirectory}/package.json`;

  beforeEach(() => {
    readFile = jest.spyOn(fs.promises, "readFile");

    readFile.mockImplementationOnce(async () => {
      return JSON.stringify({
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

  test("execution fails when package name is missing", async () => {
    const commandStub = new NpmBumpPackageVersionCommandStub();
    const expectedError = `Package ${PACKAGE_JSON_PATH} 'version' or 'name' properties are missing`;

    readFile.mockReset().mockImplementation(async () => {
      return JSON.stringify({
        name: undefined,
      });
    });

    return expect(commandStub.do()).rejects.toEqual(new Error(expectedError));
  });

  test("npm version command is called using 'version'", async () => {
    const expectedVersion = `0.${Date.now()}.1`;
    const commandStub = new NpmBumpPackageVersionCommandStub({
      version: expectedVersion,
    });

    readFile.mockImplementationOnce(async () => {
      return JSON.stringify({
        name: PACKAGE_NAME,
        version: expectedVersion,
      });
    });

    await commandStub.do();

    expect(logger.info).toBeCalledWith(`Changed package '${PACKAGE_NAME}' version to '${expectedVersion}'`);

    expect(execute).toBeCalledWith("npm", ["version", expectedVersion, "--no-git-tag-version"], {
      cwd: expected.workingDirectory,
    });
  });

  test("execution fails when package version is missing", async () => {
    const commandStub = new NpmBumpPackageVersionCommandStub();
    const expectedError = `Package ${PACKAGE_JSON_PATH} 'version' or 'name' properties are missing`;

    readFile.mockReset().mockImplementation(async () => {
      return JSON.stringify({
        name: PACKAGE_NAME,
        version: undefined,
      });
    });

    const [error] = await to(commandStub.do());

    expect(error).toEqual(new Error(expectedError));
  });

  test("npm version command is called using 'preReleaseId'", async () => {
    const expectedPreReleaseId = "beta";
    const expectedVersion = `0.${Date.now()}.0-${expectedPreReleaseId}.0`;
    const commandStub = new NpmBumpPackageVersionCommandStub({
      preReleaseId: expectedPreReleaseId,
    });
    const expectedArgs = ["version", "prerelease", `--preid=${expectedPreReleaseId}`, "--no-git-tag-version"];

    readFile.mockImplementationOnce(async () => {
      return JSON.stringify({
        name: PACKAGE_NAME,
        version: expectedVersion,
      });
    });

    await commandStub.do();

    expect(execute).toBeCalledWith("npm", expectedArgs, {
      cwd: expected.workingDirectory,
    });

    expect(logger.info).toBeCalledWith(`Changed package '${PACKAGE_NAME}' version to '${expectedVersion}'`);
  });

  test("undo reverts to initial version when version was bumped", async () => {
    const expectedVersion = `0.${Date.now()}.0`;
    const commandStub = new NpmBumpPackageVersionCommandStub({
      version: expectedVersion,
    });
    const expectedArgs = ["version", expectedVersion, "--no-git-tag-version"];

    readFile.mockImplementationOnce(async () => {
      return JSON.stringify({
        name: PACKAGE_NAME,
        version: expectedVersion,
      });
    });

    await commandStub.do();

    readFile.mockImplementationOnce(async () => {
      return JSON.stringify({
        name: PACKAGE_NAME,
        version: PACKAGE_VERSION,
      });
    });

    await commandStub.undo();

    expect(execute).toBeCalledWith("npm", expectedArgs, {
      cwd: expected.workingDirectory,
    });

    expect(logger.info).toBeCalledWith(`Reverted '${PACKAGE_NAME}' version back to '${PACKAGE_VERSION}'`);
  });

  test("undo does not revert to initial version when version was not bumped", async () => {
    const expectedVersion = `0.${Date.now()}.0`;
    const commandStub = new NpmBumpPackageVersionCommandStub({
      version: expectedVersion,
    });
    const expectedArgs = ["version", expectedVersion, "--no-git-tag-version"];

    readFile.mockReset().mockImplementation(async () => {
      return JSON.stringify({
        name: "test",
        version: undefined,
      });
    });

    await to(commandStub.do());
    await commandStub.undo();

    expect(execute).not.toBeCalledWith("npm", expectedArgs, {
      cwd: expected.workingDirectory,
    });
  });
});
