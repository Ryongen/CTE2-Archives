/**
 * `GET /builds`: the SQL behind the list and its facet sidebar.
 *
 * Facet counts follow the usual faceted-search rule. A kind with nothing picked counts over the
 * fully filtered set. A kind with values picked counts over the set filtered by everything
 * *except* that kind, so after picking one skill the sidebar still shows the other skills that
 * picking would add (values within a kind are OR'd). That's one query for the unpicked kinds plus
 * one per picked kind, all sent to D1 as a single batch.
 */

import { FACET_KINDS, type FacetKind } from "@cte2/schema";
import { PAGE_SIZE, type BuildFilters } from "@cob/shared";

/** Values shown per facet kind in the sidebar. */
export const FACET_LIMIT = 30;

export type Query = { sql: string; params: (string | number)[] };

/** The derived row for a build's main stage, which is what list numbers mean. */
export const MAIN_DERIVED = `LEFT JOIN build_derived d ON d.build_id = b.id AND d.stage_id =
  (SELECT s.stage_id FROM build_stages s WHERE s.build_id = b.id AND s.is_main = 1)`;

const ORDER: Record<BuildFilters["sort"], string> = {
  new: "b.created_at DESC",
  level: "b.level DESC, b.created_at DESC",
  dps: "d.dps DESC NULLS LAST, b.created_at DESC",
  ehp: "d.ehp DESC NULLS LAST, b.created_at DESC",
};

/** The WHERE clause for `filters`, leaving out the facet kind `except` when given. */
export function whereClause(filters: BuildFilters, except?: FacetKind): Query {
  const parts = ["b.visibility = 'public'", "b.status IN ('pending', 'indexed')"];
  const params: (string | number)[] = [];
  for (const kind of FACET_KINDS) {
    const values = filters.facets[kind];
    if (kind === except || values === undefined || values.length === 0) continue;
    parts.push(
      `b.id IN (SELECT build_id FROM build_facets WHERE kind = ? AND value IN (${values.map(() => "?").join(", ")}))`,
    );
    params.push(kind, ...values);
  }
  if (filters.levelMin !== undefined) {
    parts.push("b.level >= ?");
    params.push(filters.levelMin);
  }
  if (filters.levelMax !== undefined) {
    parts.push("b.level <= ?");
    params.push(filters.levelMax);
  }
  if (filters.q !== undefined) {
    parts.push("b.title LIKE ? ESCAPE '\\'");
    params.push(`%${filters.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  }
  return { sql: parts.join(" AND "), params };
}

export function rowsQuery(filters: BuildFilters): Query {
  const where = whereClause(filters);
  return {
    sql: `SELECT b.id, b.kind, b.source, b.verified, b.title, b.level, b.ascendancy, b.main_skill,
        b.mns_version, b.status, b.created_at, d.dps, d.ehp, d.life, d.es, d.build_id AS derived_id,
        (SELECT group_concat(f.value, ',') FROM build_facets f WHERE f.build_id = b.id AND f.kind = 'unique') AS uniques
      FROM builds b ${MAIN_DERIVED}
      WHERE ${where.sql}
      ORDER BY ${ORDER[filters.sort]}
      LIMIT ? OFFSET ?`,
    params: [...where.params, PAGE_SIZE, (filters.page - 1) * PAGE_SIZE],
  };
}

export function countQuery(filters: BuildFilters): Query {
  const where = whereClause(filters);
  return { sql: `SELECT COUNT(*) AS total FROM builds b WHERE ${where.sql}`, params: where.params };
}

/**
 * Facet counts: `kind` given counts that kind alone, without its own filter; `kind` omitted counts
 * every kind under the full filter.
 */
export function facetQuery(filters: BuildFilters, kind?: FacetKind): Query {
  const where = whereClause(filters, kind);
  const kindFilter = kind === undefined ? "" : "AND f.kind = ?";
  return {
    sql: `SELECT kind, value, n FROM (
        SELECT f.kind, f.value, COUNT(*) AS n,
          ROW_NUMBER() OVER (PARTITION BY f.kind ORDER BY COUNT(*) DESC, f.value) AS rn
        FROM build_facets f JOIN builds b ON b.id = f.build_id
        WHERE ${where.sql} ${kindFilter}
        GROUP BY f.kind, f.value
      ) WHERE rn <= ?`,
    params: [...where.params, ...(kind === undefined ? [] : [kind]), FACET_LIMIT],
  };
}

/** The kinds that need their own facet query, because something in them is picked. */
export function pickedKinds(filters: BuildFilters): FacetKind[] {
  return FACET_KINDS.filter((kind) => (filters.facets[kind]?.length ?? 0) > 0);
}
