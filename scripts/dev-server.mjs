import { createServer } from "node:http";
import { createRequire } from "node:module";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const hostname = process.env.HOSTNAME ?? "127.0.0.1";
process.env.NEXT_TELEMETRY_DISABLED = "1";

console.time("Loaded Next");
const require = createRequire(import.meta.url);
const next = require("next");
console.timeEnd("Loaded Next");

const app = next({
  dev: true,
  hostname,
  port,
  dir: process.cwd()
});
const handle = app.getRequestHandler();

try {
  console.time("Prepared app");
  await app.prepare();
  console.timeEnd("Prepared app");

  const server = createServer((request, response) => {
    handle(request, response);
  });

  server.requestTimeout = 45_000;
  server.headersTimeout = 50_000;
  server.keepAliveTimeout = 5_000;
  server.timeout = 45_000;

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${hostname}:${port} is already in use. Stop the existing dev server or run with PORT=3001 npm run dev.`);
      process.exit(1);
    }

    console.error(error);
    process.exit(1);
  });

  server.listen(port, hostname, () => {
    console.log(`Ready on http://${hostname}:${port}`);
  });
} catch (error) {
  console.error(error);
  process.exit(1);
}
