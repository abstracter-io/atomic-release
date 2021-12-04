const { PACKAGE_ROOT, PROJECT_ROOT } = require("./constants");
const { GithubNpmPackageStrategy } = require("../build/compiled/strategies");
const { gitSemanticRelease } = require("../build/compiled/adapters/git-semantic-release");

const github = {
  owner: "abstracter-io",
  repo: "atomic-release",
  host: "https://github.com",
};

const betaBranchName = "beta";
const stableBranchName = "main";

const createRelease = () => {
  return gitSemanticRelease({
    stableBranchName,

    workingDirectory: PROJECT_ROOT,

    preReleaseBranches: {
      beta: betaBranchName,
    },

    conventionalChangelogWriterContext: {
      host: github.host,
      owner: github.owner,
      repository: github.repo,
      repoUrl: `${github.host}/${github.owner}/${github.repo}`,
    },
  });
};

const runStrategy = (release) => {
  /*
   * To publish a flat package, the working directory for the npm
   * relevant commands (version change & publish) is set to the
   * the package root folder (ts out directory).
   */
  const strategy = new GithubNpmPackageStrategy({
    release,

    remote: "origin",

    isReleaseBranch(branchName) {
      return branchName === stableBranchName || branchName === betaBranchName;
    },

    changelogFilePath: `${PROJECT_ROOT}/CHANGELOG.md`,

    gitActor: process.env.RELEASE_ACTOR,

    packageRoot: PACKAGE_ROOT,

    workingDirectory: PROJECT_ROOT,

    regenerateChangeLog: true,

    github: {
      repo: github.repo,
      owner: github.owner,
      personalAccessToken: process.env.GITHUB_PAT_TOKEN,
    },

    branchConfig: {
      [stableBranchName]: {
        isStableGithubRelease: true,
        npmRegistryDistTag: "latest",
      },

      beta: {
        npmRegistryDistTag: betaBranchName,
      },
    },
  });

  return strategy.run();
};

module.exports = {
  atomicRelease: () => {
    return createRelease().then(runStrategy);
  },
};
