import fs from "fs";
import path from "path";
import { vitest, describe, test, expect, beforeAll, afterEach } from "vitest";

import { Stubs } from "../stubs";
import { Commands } from "../../src";

const PACKAGE_JSON_PATH = path.resolve(__dirname, "../fixtures/package.json");

class FileWriteCommandStub extends Commands.FileWriterCommand {
  private static readonly DEFAULT_OPTIONS: Commands.FileWriterCommandConfig = {
    logger: new Stubs.LoggerStub(),
    create: false,
    mode: "append",
    content: "[CONTENT]",
    absoluteFilePath: PACKAGE_JSON_PATH,
  };

  constructor(options?: Partial<Commands.FileWriterCommandConfig>) {
    super(Object.assign({}, FileWriteCommandStub.DEFAULT_OPTIONS, options));
  }
}

describe("managing a file content", () => {
  let access, readFile, writeFile, unlink;

  beforeAll(() => {
    access = vitest.spyOn(fs.promises, "access");
    unlink = vitest.spyOn(fs.promises, "unlink");
    readFile = vitest.spyOn(fs.promises, "readFile");
    writeFile = vitest.spyOn(fs.promises, "writeFile");
  });

  afterEach(() => {
    access.mockClear();
    unlink.mockClear();
    readFile.mockClear();
    writeFile.mockClear();
  });

  test("undo deletes file when file is created", async () => {
    const logger = new Stubs.LoggerStub();
    const expectedContent = "EXPECTED_CONTENT";
    const filePath = path.resolve(__dirname, "../fixtures/does-not-exists.json");
    const fileWriterCommand = new FileWriteCommandStub({
      logger,

      create: true,
      content: expectedContent,
      absoluteFilePath: filePath,
    });

    unlink.mockImplementationOnce(() => {
      return Promise.resolve();
    });

    access.mockImplementationOnce(() => {
      return Promise.reject(new Error());
    });

    writeFile.mockImplementationOnce(() => {
      return Promise.resolve();
    });

    await fileWriterCommand.do();
    await fileWriterCommand.undo();

    expect(unlink).toBeCalledWith(filePath);

    expect(logger.info).toBeCalledWith(`Deleted file ${filePath}`);
  });

  test("undo restores content when file existed", async () => {
    const logger = new Stubs.LoggerStub();
    const initialContent = "INITIAL CONTENT";
    const expectedContent = "EXPECTED CONTENT";
    const fileWriterCommand = new FileWriteCommandStub({
      logger,

      create: true,
      content: expectedContent,
      absoluteFilePath: PACKAGE_JSON_PATH,
    });

    writeFile.mockImplementation(() => {
      return Promise.resolve();
    });

    access.mockImplementationOnce(() => {
      return Promise.resolve();
    });

    readFile.mockImplementationOnce(() => {
      return Promise.resolve(initialContent);
    });

    await fileWriterCommand.do();

    await fileWriterCommand.undo();

    expect(writeFile).toHaveBeenCalledTimes(2);

    expect(writeFile).toBeCalledWith(PACKAGE_JSON_PATH, initialContent);

    expect(logger.info).toBeCalledWith(`Reverted file ${PACKAGE_JSON_PATH}`);
  });

  test("file is created when file does not exist", async () => {
    const logger = new Stubs.LoggerStub();
    const expectedContent = "EXPECTED_CONTENT";
    const filePath = path.resolve(__dirname, "../fixtures/does-not-exists.json");
    const fileWriterCommand = new FileWriteCommandStub({
      logger,

      create: true,
      content: expectedContent,
      absoluteFilePath: filePath,
    });

    access.mockImplementationOnce(() => {
      return Promise.reject(new Error());
    });

    writeFile.mockImplementationOnce(() => {
      return Promise.resolve();
    });

    await fileWriterCommand.do();

    expect(access).toBeCalledWith(filePath, fs.constants.F_OK);
    expect(writeFile).toBeCalledWith(filePath, expectedContent);
    expect(logger.info).toBeCalledWith(`Created file ${filePath}`);
  });

  test("file content is appended/prepended/replaced", async () => {
    const newContent = "NEW CONTENT";
    const initialContent = "SOME CONTENT";
    const cases = [
      {
        mode: "append",
        expectedContent: `${initialContent}${newContent}`,
        log: `Appended content to file ${PACKAGE_JSON_PATH}`,
      },
      {
        mode: "prepend",
        expectedContent: `${newContent}${initialContent}`,
        log: `Prepended content to file ${PACKAGE_JSON_PATH}`,
      },
      {
        mode: "replace",
        expectedContent: `${newContent}`,
        log: `Replaced ${PACKAGE_JSON_PATH} content`,
      },
    ];

    for (const testCase of cases) {
      const logger = new Stubs.LoggerStub();
      const fileWriterCommand = new FileWriteCommandStub({
        logger,

        content: newContent,
        absoluteFilePath: PACKAGE_JSON_PATH,
        mode: testCase.mode as Commands.FileWriterCommandConfig["mode"],
      });

      access.mockImplementation(() => {
        return Promise.resolve();
      });
      readFile.mockImplementation(() => {
        return Promise.resolve(initialContent);
      });
      writeFile.mockImplementationOnce(() => {
        return Promise.resolve();
      });

      await fileWriterCommand.do();

      expect(logger.info).toBeCalledWith(testCase.log);
      expect(writeFile).toBeCalledWith(PACKAGE_JSON_PATH, testCase.expectedContent);
    }
  });
});
