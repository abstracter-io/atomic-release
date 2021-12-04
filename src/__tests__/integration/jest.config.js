const path = require("path");
const root = path.resolve(__dirname, "../../../");

module.exports = {
  rootDir: root,
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/integration/**/*.test.ts"],
  setupFilesAfterEnv: ["./src/__tests__/jest-setup.js"],
  moduleFileExtensions: ["ts", "js", "json", "node"],

  displayName: {
    name: `Integration Tests`,
    color: "cyanBright",
  },

  transform: {
    "^.+\\.ts?$": "ts-jest",
  },

  // collectCoverageFrom: ["**"],
  coveragePathIgnorePatterns: ["__tests__", "\\.d.ts"],
  collectCoverage: process.env.CI !== undefined,
  coverageDirectory: `build/coverage/integration`,
};
