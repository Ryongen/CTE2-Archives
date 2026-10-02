#!/usr/bin/env node
/**
 * Bring the planner's catalogue data into this repo, and load each pack's index into D1.
 *
 * Game data never goes in git (see .gitignore). cte2-pob's `npm run catalogue-data` writes
 * `data/catalogue/<mnsVersion>/{snapshot.json, index-data.json}` from a local CTE2 install; this
 * copies that into `data/catalogue/` here, puts the slim snapshot where the web app serves it, and
 * writes `data/packs.sql`, which upserts every pack's index into the `packs` table.
 *
 *   node tools/sync-catalogue-data.mjs [--from <dir>] [--local | --remote]
 *
 * `--from` defaults to the sibling checkout `../cte2-pob/data/catalogue`. With `--local` or
 * `--remote`, the SQL is also applied to that D1 database.
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const fromIndex = args.indexOf("--from");
const from = resolve(fromIndex >= 0 ? args[fromIndex + 1] : join(root, "..", "cte2-pob", "data", "catalogue"));
const target = args.includes("--remote") ? "--remote" : args.includes("--local") ? "--local" : null;

if (!existsSync(from)) {
  console.error(`No catalogue data at ${from}. Run \`npm run catalogue-data\` in cte2-pob first, or pass --from.`);
  process.exit(1);
}

const sqlString = (text) => `'${text.replaceAll("'", "''")}'`;
const statements = [];
for (const version of readdirSync(from)) {
  const source = join(from, version);
  const indexPath = join(source, "index-data.json");
  if (!existsSync(indexPath)) continue;

  const dest = join(root, "data", "catalogue", version);
  const web = join(root, "apps", "web", "public", "data", version);
  mkdirSync(dest, { recursive: true });
  mkdirSync(web, { recursive: true });
  for (const file of ["index-data.json", "snapshot.json"]) {
    if (!existsSync(join(source, file))) continue;
    copyFileSync(join(source, file), join(dest, file));
    copyFileSync(join(source, file), join(web, file));
  }

  // Compact JSON: D1 stores it as one TEXT value, and whitespace there is just bytes.
  const index = JSON.stringify(JSON.parse(readFileSync(indexPath, "utf8")));
  statements.push(
    `INSERT INTO packs (mns_version, index_data) VALUES (${sqlString(version)}, ${sqlString(index)})\n` +
      `  ON CONFLICT (mns_version) DO UPDATE SET index_data = excluded.index_data;`,
  );
  console.log(`pack ${version}`);
}

if (statements.length === 0) {
  console.error(`No packs found under ${from}.`);
  process.exit(1);
}

const sqlPath = join(root, "data", "packs.sql");
writeFileSync(sqlPath, statements.join("\n") + "\n");
console.log(`wrote ${sqlPath}`);

if (target !== null) {
  execFileSync("npx", ["wrangler", "d1", "execute", "cob-codex", target, "--file", sqlPath], {
    cwd: join(root, "apps", "api"),
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}
