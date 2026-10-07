/**
 * The indexer: asks the API for builds that need numbers, computes them, and sends them back.
 *
 *   CATALOGUE_API=http://localhost:8787 INDEXER_TOKEN=... node src/main.ts [--snapshot <path>]
 *
 * The snapshot is the one CoB's published site serves (`COB_SITE`, the same default the web app
 * uses), or a local file with `--snapshot`. Builds indexed against another pack are recomputed,
 * so after a pack update the next run redoes everything.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import type { Snapshot } from "@cte2/extractor";
import { buildIndexData, type BuildDoc } from "@cte2/schema";
import type { DerivedRequest, PendingResponse } from "@cob/shared";

import { deriveForCatalogue } from "./derive.ts";

const API = (process.env.CATALOGUE_API ?? "http://localhost:8787").replace(/\/$/, "");
const TOKEN = process.env.INDEXER_TOKEN;
const COB_SITE = (process.env.COB_SITE ?? "https://ryongen.github.io/Craft-Of-Building/").replace(/\/?$/, "/");
/** Stop starting new batches after this long, so a backlog can't eat a whole Actions budget. */
const TIME_BUDGET_MS = Number(process.env.TIME_BUDGET_MS ?? 8 * 60_000);
const BATCH = 20;

if (!TOKEN) {
  console.error("INDEXER_TOKEN is not set.");
  process.exit(1);
}

const auth = { authorization: `Bearer ${TOKEN}` };

async function loadSnapshot(): Promise<Snapshot> {
  const at = process.argv.indexOf("--snapshot");
  if (at >= 0) {
    const path = process.argv[at + 1];
    if (path === undefined) throw new Error("--snapshot needs a path");
    return JSON.parse(readFileSync(path, "utf8")) as Snapshot;
  }
  const manifest = (await getJson(`${COB_SITE}data/manifest.json`)) as { snapshot: string };
  return (await getJson(COB_SITE + manifest.snapshot)) as Snapshot;
}

async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${url}: ${response.status} ${await response.text()}`);
  return response.json();
}

async function main(): Promise<void> {
  const started = Date.now();
  const snapshot = await loadSnapshot();
  const index = buildIndexData(snapshot);
  const pack = snapshot.meta.mineAndSlashVersion;
  console.log(`pack ${pack}, api ${API}`);

  // A build whose PUT failed comes back in the next batch; don't spin on it.
  const tried = new Set<string>();
  let indexed = 0;
  let invalid = 0;
  let failed = 0;
  while (Date.now() - started < TIME_BUDGET_MS) {
    const query = new URLSearchParams({ pack, limit: String(BATCH) });
    const { builds } = (await getJson(`${API}/internal/pending?${query}`, auth)) as PendingResponse;
    const fresh = builds.filter((b) => !tried.has(b.id));
    if (fresh.length === 0) break;

    for (const build of fresh) {
      tried.add(build.id);
      let result: DerivedRequest;
      try {
        result = deriveForCatalogue(JSON.parse(build.doc) as BuildDoc, snapshot, index);
      } catch (error) {
        result = { status: "invalid", reason: error instanceof Error ? error.message : String(error) };
      }
      const response = await fetch(`${API}/internal/builds/${encodeURIComponent(build.id)}/derived`, {
        method: "PUT",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ ...result, docHash: createHash("sha256").update(build.doc).digest("hex") }),
      });
      if (response.status === 409) {
        // Edited mid-run; it's still pending, so the next batch picks up the new document.
        tried.delete(build.id);
        console.log(`${build.id}: changed while indexing, redoing`);
      } else if (!response.ok) {
        failed++;
        console.error(`${build.id}: ${response.status} ${await response.text()}`);
      } else if (result.status === "invalid") {
        invalid++;
        console.log(`${build.id}: invalid (${result.reason})`);
      } else {
        indexed++;
        const first = result.stages[0];
        console.log(`${build.id}: dps ${first?.dps ?? "-"}, ehp ${first?.ehp ?? "-"}`);
      }
    }
  }
  console.log(`done: ${indexed} indexed, ${invalid} invalid, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

await main();
