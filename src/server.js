const { start } = require("./server/start");

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", err && err.message ? err.message : err);
  process.exitCode = 1;
});

