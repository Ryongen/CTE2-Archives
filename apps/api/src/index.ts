import { Hono } from "hono";
import { cors } from "hono/cors";

import type { BuildSummary, FacetKind, IndexData } from "@cte2/schema";
import {
  MAX_UPLOAD_BYTES,
  PAGE_SIZE,
  parseFilters,
  type BuildDetail,
  type BuildListResponse,
  type BuildRow,
  type FacetCount,
  type UploadRequest,
  type UploadResponse,
} from "@cob/shared";

import type { Env } from "./env.ts";
import { newId, newToken, sha256Hex } from "./ids.ts";
import { MAIN_DERIVED, countQuery, facetQuery, pickedKinds, rowsQuery, whereClause, type Query } from "./list.ts";
import { choosePack, contentKey, prepareBuild, readUpload, UploadError } from "./upload.ts";

/** D1 refuses a statement with more than 100 bound parameters. */
const MAX_PARAMS = 100;

const app = new Hono<{ Bindings: Env }>();

// Everything is readable from anywhere: CoB fetches `/builds/:id/doc` from its own origin, and
// uploads are guarded by Turnstile rather than by origin.
app.use("*", cors());

app.onError((error, c) => {
  if (error instanceof UploadError) return c.json({ error: error.message }, error.status);
  console.error(error);
  return c.json({ error: "Something went wrong" }, 500);
});

app.get("/", (c) => c.json({ name: "cob-codex", ok: true }));

app.get("/packs", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT mns_version FROM packs ORDER BY created_at DESC",
  ).all<{ mns_version: string }>();
  return c.json({ packs: results.map((r) => r.mns_version) });
});

app.post("/builds", async (c) => {
  const declared = Number(c.req.header("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES) throw new UploadError("Build is too large", 413);
  const text = await c.req.text();
  if (text.length > MAX_UPLOAD_BYTES) throw new UploadError("Build is too large", 413);

  let request: UploadRequest;
  try {
    request = JSON.parse(text) as UploadRequest;
  } catch {
    throw new UploadError("Request body is not JSON");
  }
  if (request === null || typeof request !== "object" || request.build === undefined) {
    throw new UploadError("Request has no `build`");
  }

  if (c.env.TURNSTILE_SECRET) {
    const ok = await verifyTurnstile(c.env.TURNSTILE_SECRET, request.turnstileToken, c.req.header("cf-connecting-ip"));
    if (!ok) throw new UploadError("Captcha check failed, please try again", 403);
  }

  const read = await readUpload(request.build);
  const packs = await c.env.DB.prepare("SELECT mns_version, index_data FROM packs ORDER BY created_at DESC")
    .all<{ mns_version: string; index_data: string }>()
    .then((r) => r.results.map((p) => ({ mnsVersion: p.mns_version, indexData: p.index_data })));
  const pack = choosePack(read.doc, packs);
  if (pack === undefined) throw new UploadError("The catalogue has no game data loaded yet", 503);

  const prepared = prepareBuild(read, request, JSON.parse(pack.indexData) as IndexData);
  const hash = await sha256Hex(contentKey(prepared.doc));
  const existing = await c.env.DB.prepare("SELECT id FROM builds WHERE content_hash = ?")
    .bind(hash)
    .first<{ id: string }>();
  if (existing !== null) return c.json({ id: existing.id, duplicate: true } satisfies UploadResponse);

  const id = newId();
  const editToken = newToken();
  const db = c.env.DB;
  const s = prepared.summary;
  await db.batch([
    db
      .prepare(
        `INSERT INTO builds (id, kind, source, title, notes_md, pack_version, mns_version, level, ascendancy,
          main_skill, summary, content_hash, edit_token_hash, visibility)
        VALUES (?, ?, 'web', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        prepared.observed === null ? "planned" : "capture",
        prepared.title,
        prepared.notes,
        prepared.packVersion,
        prepared.mnsVersion,
        s.level,
        s.ascendancy ?? null,
        s.mainSkill ?? null,
        JSON.stringify(s),
        hash,
        await sha256Hex(editToken),
        prepared.visibility,
      ),
    db
      .prepare("INSERT INTO build_docs (build_id, doc, observed) VALUES (?, ?, ?)")
      .bind(id, JSON.stringify(prepared.doc), prepared.observed === null ? null : JSON.stringify(prepared.observed)),
    ...prepared.facets.map((f) =>
      db.prepare("INSERT OR IGNORE INTO build_facets (build_id, kind, value) VALUES (?, ?, ?)").bind(id, f.kind, f.value),
    ),
    ...prepared.stages.map((st) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO build_stages (build_id, stage_id, position, name, level, is_main, main_skill)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(id, st.stageId, st.position, st.name, st.level, st.isMain ? 1 : 0, st.mainSkill),
    ),
  ]);

  return c.json({ id, duplicate: false, editToken } satisfies UploadResponse, 201);
});

app.get("/builds", async (c) => {
  const filters = parseFilters(new URL(c.req.url).searchParams);
  if (whereClause(filters).params.length > MAX_PARAMS - 5) {
    return c.json({ error: "Too many filters at once" }, 400);
  }
  const db = c.env.DB;
  const bind = (q: Query) => db.prepare(q.sql).bind(...q.params);
  const picked = pickedKinds(filters);
  const [rows, count, everyKind, ...perKind] = await db.batch([
    bind(rowsQuery(filters)),
    bind(countQuery(filters)),
    bind(facetQuery(filters)),
    ...picked.map((kind) => bind(facetQuery(filters, kind))),
  ]);

  const facets: BuildListResponse["facets"] = {};
  // The every-kind query's counts for a picked kind are filtered by that kind itself; its own
  // query has the right ones.
  const collect = (results: unknown[], fromOwnQuery: boolean) => {
    for (const r of results as { kind: FacetKind; value: string; n: number }[]) {
      if (!fromOwnQuery && picked.includes(r.kind)) continue;
      (facets[r.kind] ??= [] as FacetCount[]).push({ value: r.value, count: r.n });
    }
  };
  collect(everyKind!.results, false);
  perKind.forEach((result) => collect(result.results, true));

  return c.json({
    rows: (rows!.results as ListRow[]).map(toBuildRow),
    total: (count!.results[0] as { total: number } | undefined)?.total ?? 0,
    page: filters.page,
    pageSize: PAGE_SIZE,
    facets,
  } satisfies BuildListResponse);
});

app.get("/builds/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.env.DB;
  const [build, stages] = await db.batch([
    db
      .prepare(
        `SELECT b.*, d.dps, d.ehp, d.life, d.es, d.build_id AS derived_id,
          (SELECT group_concat(f.value, ',') FROM build_facets f WHERE f.build_id = b.id AND f.kind = 'unique') AS uniques,
          (SELECT x.observed IS NOT NULL FROM build_docs x WHERE x.build_id = b.id) AS has_observed
        FROM builds b ${MAIN_DERIVED}
        WHERE b.id = ? AND b.status != 'hidden'`,
      )
      .bind(id),
    db
      .prepare(
        "SELECT stage_id, name, level, is_main, main_skill FROM build_stages WHERE build_id = ? ORDER BY position",
      )
      .bind(id),
  ]);
  const row = build!.results[0] as (ListRow & DetailExtras) | undefined;
  if (row === undefined) return c.json({ error: "No such build" }, 404);

  return c.json({
    ...toBuildRow(row),
    notes: row.notes_md,
    packVersion: row.pack_version,
    updatedAt: row.updated_at,
    summary: JSON.parse(row.summary) as BuildSummary,
    stages: (stages!.results as StageDbRow[]).map((st) => ({
      stageId: st.stage_id,
      name: st.name,
      level: st.level,
      isMain: st.is_main === 1,
      mainSkill: st.main_skill,
    })),
    hasObserved: row.has_observed === 1,
  } satisfies BuildDetail);
});

/** The raw document, for CoB's `?build=<id>` import. */
app.get("/builds/:id/doc", async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT x.doc FROM build_docs x JOIN builds b ON b.id = x.build_id WHERE x.build_id = ? AND b.status != 'hidden'`,
  )
    .bind(c.req.param("id"))
    .first<{ doc: string }>();
  if (row === null) return c.json({ error: "No such build" }, 404);
  return c.body(row.doc, 200, { "content-type": "application/json; charset=utf-8" });
});

export default app;

// ---------------------------------------------------------------------------

type ListRow = {
  id: string;
  kind: BuildRow["kind"];
  source: BuildRow["source"];
  verified: number;
  title: string;
  level: number;
  ascendancy: string | null;
  main_skill: string | null;
  mns_version: string | null;
  status: BuildRow["status"];
  created_at: string;
  dps: number | null;
  ehp: number | null;
  life: number | null;
  es: number | null;
  derived_id: string | null;
  uniques: string | null;
};

type DetailExtras = {
  notes_md: string;
  pack_version: string | null;
  updated_at: string;
  summary: string;
  has_observed: number | null;
};

type StageDbRow = { stage_id: string; name: string; level: number | null; is_main: number; main_skill: string | null };

function toBuildRow(r: ListRow): BuildRow {
  return {
    id: r.id,
    kind: r.kind,
    source: r.source,
    verified: r.verified === 1,
    title: r.title,
    level: r.level,
    ascendancy: r.ascendancy,
    mainSkill: r.main_skill,
    mnsVersion: r.mns_version,
    uniques: r.uniques === null ? [] : r.uniques.split(","),
    status: r.status,
    createdAt: r.created_at,
    derived: r.derived_id === null ? null : { dps: r.dps, ehp: r.ehp, life: r.life, es: r.es },
  };
}

async function verifyTurnstile(secret: string, token: string | undefined, ip: string | undefined): Promise<boolean> {
  if (!token) return false;
  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}
