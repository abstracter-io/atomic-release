const { atomicRelease } = require("./atomic-release");

atomicRelease().catch((e) => {
  console.error(e);
});
