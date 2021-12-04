import fs from "fs";

import { Command, CommandOptions } from "../";

type FileWriterCommandOptions = CommandOptions & {
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
class FileWriterCommand extends Command<FileWriterCommandOptions> {
  private fileWasCreated: boolean;
  private originalFileContent: null | string = null;

  public constructor(options: FileWriterCommandOptions) {
    super(options);
  }

  protected async readTextFile(): Promise<string> {
    const absoluteFilePath = this.options.absoluteFilePath;

    this.logger.debug(`Reading file ${absoluteFilePath}`);

    return await fs.promises.readFile(absoluteFilePath, {
      encoding: "utf-8",
      flag: "r",
    });
  }

  protected async filePathExists(): Promise<boolean> {
    return new Promise((resolve) => {
      const t = () => resolve(true);
      const f = () => resolve(false);

      fs.promises.access(this.options.absoluteFilePath, fs.constants.F_OK).then(t, f);
    });
  }

  protected async writeFileContent(content: string): Promise<void> {
    const { absoluteFilePath } = this.options;

    await fs.promises.writeFile(absoluteFilePath, content);
  }

  public async do(): Promise<void> {
    const fileExists = await this.filePathExists();
    const absoluteFilePath = this.options.absoluteFilePath;

    if (fileExists) {
      const mode = this.options.mode;

      this.originalFileContent = await this.readTextFile();

      if (mode === "replace") {
        await this.writeFileContent(`${this.options.content}`);

        this.logger.info(`Replaced ${absoluteFilePath} content`);
      }
      //
      else if (mode === "prepend") {
        await this.writeFileContent(`${this.options.content}${this.originalFileContent}`);

        this.logger.info(`Prepended content to file ${absoluteFilePath}`);
      }
      //
      else if (!mode || mode === "append") {
        await this.writeFileContent(`${this.originalFileContent}${this.options.content}`);

        this.logger.info(`Appended content to file ${absoluteFilePath}`);
      }
      //
      else {
        throw new Error(`Unknown mode '${mode}'`);
      }
    }
    //
    else if (this.options.create) {
      await this.writeFileContent(this.options.content);

      this.logger.info(`Created file ${absoluteFilePath}`);

      this.fileWasCreated = true;
    }
  }

  public async undo(): Promise<void> {
    if (this.fileWasCreated) {
      const absoluteFilePath = this.options.absoluteFilePath;

      await fs.promises.unlink(absoluteFilePath);

      this.logger.info(`Deleted file ${absoluteFilePath}`);
    }
    //
    else if (this.originalFileContent) {
      await this.writeFileContent(this.originalFileContent);

      this.logger.info(`Reverted file ${this.options.absoluteFilePath}`);
    }
  }
}

export { FileWriterCommand, FileWriterCommandOptions };
