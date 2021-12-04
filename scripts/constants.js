const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "../");

const PACKAGE_ROOT = path.resolve(PROJECT_ROOT, "build/compiled");

module.exports = {
  PACKAGE_ROOT,
  PROJECT_ROOT,
};
