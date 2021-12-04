// https://jestjs.io/docs/en/configuration
module.exports = {
  rootDir: "./src",
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/unit/**/*.test.ts"],
  setupFilesAfterEnv: ["./__tests__/jest-setup.js"],
  moduleFileExtensions: ["ts", "js", "json", "node"],

  displayName: {
    name: "Unit Tests",
    color: "blueBright",
  },

  transform: {
    "^.+\\.ts?$": "ts-jest",
  },

  resetMocks: true,

  // collectCoverageFrom: ["src/**"],
  coveragePathIgnorePatterns: ["__tests__", "\\.d.ts"],
  coverageDirectory: "../build/coverage/unit",
  collectCoverage: process.env.CI !== undefined,
};
