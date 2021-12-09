// eslint-disable-next-line node/no-unpublished-require
const micromatch = require("micromatch");

// https://github.com/okonet/lint-staged
module.exports = (allStagedFiles) => {
  const commands = [];
  const jsFiles = micromatch(allStagedFiles, ["**/*.js", "**/*.ts"]);

  if (jsFiles.length) {
    commands.push(`npm run lint -- ${jsFiles.join(" ")}`);
    commands.push("npm test");
    commands.push("npm run test:integration");
  }

  return commands;
};
