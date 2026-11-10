// Makes the local config files from their templates when they are missing.
//   wrangler.toml <- wrangler.example.toml (TIMEZONE = the time zone of this computer)
//   .dev.vars     <- .dev.vars.example
// It never changes a file that exists.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const at = (p) => new URL(p, root);

if (!existsSync(at("wrangler.toml"))) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const text = readFileSync(at("wrangler.example.toml"), "utf8")
    .replace(/^# Template for wrangler.toml.*\n# `npm run setup`.*\n/m, "# Made from wrangler.example.toml. Git ignores this file.\n")
    .replace(/^TIMEZONE = ".*"$/m, `TIMEZONE = "${tz}"`);
  writeFileSync(at("wrangler.toml"), text);
  console.log(`Created wrangler.toml (TIMEZONE = ${tz}).`);
}
if (!existsSync(at(".dev.vars"))) {
  copyFileSync(at(".dev.vars.example"), at(".dev.vars"));
  console.log("Created .dev.vars (local token: dev-token).");
}

// `node scripts/init-config.mjs --set-db <id>` writes the D1 database id.
const i = process.argv.indexOf("--set-db");
if (i > 0) {
  const id = process.argv[i + 1];
  if (!/^[0-9a-f-]{36}$/.test(id ?? "")) throw new Error(`Not a database id: ${id}`);
  const p = at("wrangler.toml");
  writeFileSync(p, readFileSync(p, "utf8").replace(/^database_id = ".*"$/m, `database_id = "${id}"`));
}
