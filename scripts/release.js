import { SDK } from "../build/index.js";

await SDK.githubNpmPackageStrategy().then(strategy => strategy.run());
