import { SDK } from "../build/index.js";

const strategy = await SDK.githubNpmPackageStrategy()

await strategy.run();
