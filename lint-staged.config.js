import micromatch from 'micromatch';

// https://github.com/okonet/lint-staged
export default (allStagedFiles) => {
  const commands = [];
  const jsFiles = micromatch(allStagedFiles, ['**/*.js', '**/*.ts'], {});

  if (jsFiles.length) {
    commands.push(`npm run lint -- ${jsFiles.join(' ')}`);
    commands.push('npm test');
  }

  return commands;
};
