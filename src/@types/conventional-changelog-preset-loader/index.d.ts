declare module "conventional-changelog-preset-loader" {
  import { ChangelogWriterOptions } from "conventional-changelog-writer";
  import { ConventionalCommit, ConventionalCommitsParserOptions } from "conventional-commits-parser";

  export type ConventionalChangelogPreset = {
    parserOpts: ConventionalCommitsParserOptions;
    writerOpts: ChangelogWriterOptions;

    recommendedBumpOpts: {
      parserOpts: ConventionalCommitsParserOptions;
      whatBump: (commits: ConventionalCommit[]) => { level: 0 | 1 | 2; reason: string };
    };

    conventionalChangelog: {
      parserOpts: ConventionalCommitsParserOptions;
      writerOpts: ChangelogWriterOptions;
    };
  };

  type PresetFactoryCallback = (cb: (_: null, preset: ConventionalChangelogPreset) => void) => void;

  type PresetLoader = PresetFactoryCallback | ConventionalChangelogPreset | Promise<ConventionalChangelogPreset>;

  /**
   * https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-preset-loader
   */
  function presetLoader(presetName: string): PresetLoader;

  // eslint-disable-next-line import/no-default-export
  export default presetLoader;
}
