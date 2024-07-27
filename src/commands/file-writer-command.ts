import fs from "fs";
import to from "await-to-js";

import { Command, CommandConfig } from "../sdk/command";

type FileWriterCommandConfig = CommandConfig & {
  content: string;
  create?: boolean;
  absoluteFilePath: string;
  mode?: "append" | "prepend" | "replace";
};

/**
 @example Creating a file

 const command = new FileWriterCommand({
    create: true,
    content: "This is SPARTA",
    absoluteFilePath: "/home/dev/project/file.txt",
 });

 <br />

 @example Modifying a file

 const command = new FileWriterCommand({
    content: "42",
    mode: "append | prepend | replace", <-- Choose one ("append" is the default)
    absoluteFilePath: "/home/dev/project/existing.txt",
 });
 */
class FileWriterCommand extends Command<FileWriterCommandConfig> {
  private fileWasCreated: boolean;
  private originalFileContent: null | string = null;

  protected async readTextFile(): Promise<string> {
    const absoluteFilePath = this.config.absoluteFilePath;

    this.logger.debug(`Reading file ${absoluteFilePath}`);

    return fs.promises.readFile(absoluteFilePath, {
      encoding: "utf-8",
      flag: "r",
    });
  }

  protected async filePathExists(): Promise<boolean> {
    const [error] = await to(fs.promises.access(this.config.absoluteFilePath, fs.constants.F_OK));

    return error === null;
  }

  protected async writeFileContent(content: string): Promise<void> {
    const { absoluteFilePath } = this.config;

    await fs.promises.writeFile(absoluteFilePath, content);
  }

  public async do(): Promise<void> {
    const fileExists = await this.filePathExists();
    const absoluteFilePath = this.config.absoluteFilePath;

    if (fileExists) {
      const mode = this.config.mode;

      this.originalFileContent = await this.readTextFile();

      if (mode === "replace") {
        await this.writeFileContent(`${this.config.content}`);

        this.logger.info(`Replaced ${absoluteFilePath} content`);
      }
      //
      else if (mode === "prepend") {
        await this.writeFileContent(`${this.config.content}${this.originalFileContent}`);

        this.logger.info(`Prepended content to file ${absoluteFilePath}`);
      }
      //
      else if (!mode || mode === "append") {
        await this.writeFileContent(`${this.originalFileContent}${this.config.content}`);

        this.logger.info(`Appended content to file ${absoluteFilePath}`);
      }
      //
      else {
        throw new Error(`Unknown mode '${mode}'`);
      }
    }
    //
    else if (this.config.create) {
      await this.writeFileContent(this.config.content);

      this.logger.info(`Created file ${absoluteFilePath}`);

      this.fileWasCreated = true;
    }
  }

  public async undo(): Promise<void> {
    if (this.fileWasCreated) {
      const absoluteFilePath = this.config.absoluteFilePath;

      await fs.promises.unlink(absoluteFilePath);

      this.logger.info(`Deleted file ${absoluteFilePath}`);
    }
    //
    else if (this.originalFileContent) {
      await this.writeFileContent(this.originalFileContent);

      this.logger.info(`Reverted file ${this.config.absoluteFilePath}`);
    }
  }
}

export { FileWriterCommand, FileWriterCommandConfig };
