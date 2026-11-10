// Stops `npm run deploy` when wrangler.toml is missing or has no database id.
import { existsSync, readFileSync } from "node:fs";
const p = new URL("../wrangler.toml", import.meta.url);
if (!existsSync(p) || readFileSync(p, "utf8").includes("00000000-0000-0000-0000-000000000000")) {
  console.error("wrangler.toml is missing or has no database id. Run `npm run setup` first.");
  process.exit(1);
}
