import { spawnSync } from "node:child_process";

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Usage: node scripts/run-next-command.mjs <command> [...args]");
  process.exit(1);
}

process.env.NEXT_TELEMETRY_DISABLED = "1";

const result = spawnSync(command, args, {
  env: process.env,
  shell: true,
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
