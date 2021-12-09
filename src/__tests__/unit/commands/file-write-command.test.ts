import fs from "fs";
import path from "path";

import { spiedLogger } from "../../stubs/spied-logger";
import { FileWriterCommand, FileWriterCommandOptions } from "../../../commands";

const PACKAGE_JSON_PATH = path.resolve(__dirname, "../fixtures/package.json");

class FileWriteCommandStub extends FileWriterCommand {
  private static readonly DEFAULT_OPTIONS: FileWriterCommandOptions = {
    logger: spiedLogger(),
    create: false,
    mode: "append",
    content: "[CONTENT]",
    absoluteFilePath: PACKAGE_JSON_PATH,
  };

  constructor(options?: Partial<FileWriterCommandOptions>) {
    super(Object.assign({}, FileWriteCommandStub.DEFAULT_OPTIONS, options));
  }
}

describe("managing a file content", () => {
  let access, readFile, writeFile, unlink;

  beforeAll(() => {
    access = jest.spyOn(fs.promises, "access");
    unlink = jest.spyOn(fs.promises, "unlink");
    readFile = jest.spyOn(fs.promises, "readFile");
    writeFile = jest.spyOn(fs.promises, "writeFile");
  });

  test("undo deletes file when file is created", async () => {
    const logger = spiedLogger();
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
    const logger = spiedLogger();
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
    const logger = spiedLogger();
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
      const logger = spiedLogger();
      const fileWriterCommand = new FileWriteCommandStub({
        logger,

        content: newContent,
        absoluteFilePath: PACKAGE_JSON_PATH,
        mode: testCase.mode as FileWriterCommandOptions["mode"],
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
