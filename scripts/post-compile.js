const fs = require("fs");
const path = require("path");
const { PACKAGE_ROOT, PROJECT_ROOT } = require("./constants");

const copyFile = (src, dest) => {
  return fs.promises.copyFile(src, dest).then(() => {
    console.log(`Copied from ${src} to ${dest}`);
  });
};

const recursiveDirCopy = (src, dest) => {
  const copy = (src, dest) => {
    return fs.promises.mkdir(dest, { recursive: true }).then(() => {
      return fs.promises.readdir(src, { withFileTypes: true }).then((entries) => {
        const promises = [];

        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);

          if (entry.isDirectory()) {
            promises.push(copy(srcPath, destPath));
          }
          //
          else {
            promises.push(fs.promises.copyFile(srcPath, destPath));
          }
        }

        return Promise.all(promises);
      });
    });
  };

  return copy(src, dest).then(() => {
    console.log(`Copied from ${src} to ${dest}`);
  });
};

const copyFiles = () => {
  return Promise.all([
    copyFile(`${PROJECT_ROOT}/package.json`, `${PACKAGE_ROOT}/package.json`),
    copyFile(`${PROJECT_ROOT}/README.md`, `${PACKAGE_ROOT}/README.md`),
    recursiveDirCopy(`${PROJECT_ROOT}/src/ports/release`, `${PACKAGE_ROOT}/ports/release`),
    recursiveDirCopy(`${PROJECT_ROOT}/src/@types`, `${PACKAGE_ROOT}/@types`),
  ]);
};

const writeNpmrc = () => {
  const path = `${PACKAGE_ROOT}/.npmrc`;
  const content = `//registry.npmjs.org/:_authToken=\${NPM_TOKEN}`;

  return fs.promises.writeFile(path, content).then(() => {
    console.log(`Wrote ${path}`);
  });
};

writeNpmrc()
  .then(copyFiles)
  .catch((e) => {
    process.exitCode = 1;

    console.error(e);
  });
