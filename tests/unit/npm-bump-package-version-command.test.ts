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

const CMD_CONFIG: Commands.NpmBumpPackageVersionCommandConfig = {
  logger: LOGGER,

  version: "0.2.0",

  workingDirectory: "/fake/path",
};

class NpmBumpPackageVersionCommandStub extends Commands.NpmBumpPackageVersionCommand {
  public constructor(config?: Partial<Commands.NpmBumpPackageVersionCommandConfig>) {
    super(Object.assign({}, CMD_CONFIG, config));
  }

  getPackageJson = vitest.fn(async () => {
    return PACKAGE_JSON
  })
}

vitest.mock("execa", () => {
  return {
    default: async (...args) => {
      return execa(...args);
    }
  };
});

describe("bumping package.json version", () => {
  const PACKAGE_JSON_PATH = `${CMD_CONFIG.workingDirectory}/package.json`;

  beforeEach(() => {
    execa.mockReset().mockImplementation(async () => {
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

    commandStub.getPackageJson.mockImplementation(async () => {
      return {
        name: undefined as any,
        version: '1',
        private: true,
      };
    });

    return expect(commandStub.do()).rejects.toEqual(new Error(expectedError));
  });

  test("npm version command is called using 'version'", async () => {
    const expectedVersion = `0.${Date.now()}.1`;
    const commandStub = new NpmBumpPackageVersionCommandStub({
      version: expectedVersion,
    });

    commandStub.getPackageJson.mockImplementationOnce(async () => {
      return PACKAGE_JSON
    });

    commandStub.getPackageJson.mockImplementationOnce(async () => {
      return {
        ...PACKAGE_JSON,
        version: expectedVersion,
      }
    })

    await commandStub.do();

    expect(LOGGER.info).toBeCalledWith(`Changed package '${PACKAGE_JSON.name}' version to '${expectedVersion}'`);

    expect(execa).toBeCalledWith("npm", ["version", expectedVersion, "--no-git-tag-version"], {
      cwd: CMD_CONFIG.workingDirectory,
    });
  });

  test("execution fails when package version is missing", async () => {
    const commandStub = new NpmBumpPackageVersionCommandStub();
    const expectedError = `Package ${PACKAGE_JSON_PATH} 'version' or 'name' properties are missing`;

    commandStub.getPackageJson.mockImplementation(async () => {
      return {
        ...PACKAGE_JSON,
        version: undefined as any,
      };
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

    commandStub.getPackageJson.mockImplementation(async () => {
      return {
        ...PACKAGE_JSON,
        version: expectedVersion,
      };
    });

    await commandStub.do();

    expect(execa).toBeCalledWith("npm", expectedArgs, {
      cwd: CMD_CONFIG.workingDirectory,
    });

    expect(LOGGER.info).toBeCalledWith(`Changed package '${PACKAGE_JSON.name}' version to '${expectedVersion}'`);
  });

  test("undo reverts to initial version when version was bumped", async () => {
    const commandStub = new NpmBumpPackageVersionCommandStub({
      version: `0.${Date.now()}.0`,
    });
    const expectedArgs = ["version", PACKAGE_JSON.version, "--no-git-tag-version"];

    await commandStub.do();

    await commandStub.undo();

    expect(execa).toBeCalledWith("npm", expectedArgs, {
      cwd: CMD_CONFIG.workingDirectory,
    });

    expect(LOGGER.info).toBeCalledWith(`Reverted '${PACKAGE_JSON.name}' version back to '${PACKAGE_JSON.version}'`);
  });

  test("undo does not revert to initial version when version was not bumped", async () => {
    const commandStub = new NpmBumpPackageVersionCommandStub({
      version: PACKAGE_JSON.version,
    });
    const expectedArgs = ["version", PACKAGE_JSON.version, "--no-git-tag-version"];

    commandStub.getPackageJson.mockImplementation(async () => {
      return PACKAGE_JSON;
    });

    await commandStub.do().catch(e => e);

    await commandStub.undo();

    expect(execa).not.toBeCalledWith("npm", expectedArgs, {
      cwd: CMD_CONFIG.workingDirectory,
    });
  });
});
