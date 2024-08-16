import micromatch from 'micromatch';

// https://github.com/okonet/lint-staged
export default (allStagedFiles) => {
  const commands = [];
  const lintables = micromatch(allStagedFiles, ['**/*.js', '**/*.ts'], {});
  const testables = micromatch(allStagedFiles, ['src/**', 'tests/**'], {});

  if (lintables.length) {
    commands.push(`npm run lint:fix -- ${lintables.join(' ')}`);
  }

  if (testables.length) {
    commands.push('npm test');
  }

  return commands;
};
