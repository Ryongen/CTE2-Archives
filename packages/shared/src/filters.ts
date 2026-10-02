/**
 * The list's filters, and their spelling in a query string. The site's URL and the API's query
 * string use the same spelling, so a list URL can be passed to the API as it is.
 *
 * Within one facet kind the values are OR'd; across kinds they are AND'd. Picking two skills
 * shows builds using either, while picking a skill and an ascendancy shows builds with both.
 */

import { FACET_KINDS, type FacetKind } from "@cte2/schema";

export const SORTS = ["new", "level", "dps", "ehp"] as const;
export type Sort = (typeof SORTS)[number];

export const PAGE_SIZE = 50;
/** Per kind, more values than this are ignored. D1 allows 100 bound parameters a query. */
export const MAX_VALUES_PER_KIND = 10;

export type BuildFilters = {
  facets: Partial<Record<FacetKind, string[]>>;
  levelMin?: number;
  levelMax?: number;
  /** Free text, matched against titles. */
  q?: string;
  sort: Sort;
  page: number;
};

export const emptyFilters = (): BuildFilters => ({ facets: {}, sort: "new", page: 1 });

export function isFacetKind(value: string): value is FacetKind {
  return (FACET_KINDS as readonly string[]).includes(value);
}

/** Facet values are comma-separated: `?skill=fireball,frost_nova&ascendancy=sanguimancer`. */
export function parseFilters(params: URLSearchParams): BuildFilters {
  const filters = emptyFilters();
  for (const kind of FACET_KINDS) {
    const raw = params.get(kind);
    if (raw === null) continue;
    const values = [...new Set(raw.split(",").map((v) => v.trim()).filter((v) => v !== ""))];
    if (values.length > 0) filters.facets[kind] = values.slice(0, MAX_VALUES_PER_KIND);
  }
  const levelMin = wholeNumber(params.get("levelMin"));
  const levelMax = wholeNumber(params.get("levelMax"));
  if (levelMin !== undefined) filters.levelMin = levelMin;
  if (levelMax !== undefined) filters.levelMax = levelMax;
  const q = params.get("q")?.trim();
  if (q) filters.q = q.slice(0, 100);
  const sort = params.get("sort");
  if (sort !== null && (SORTS as readonly string[]).includes(sort)) filters.sort = sort as Sort;
  filters.page = Math.max(1, wholeNumber(params.get("page")) ?? 1);
  return filters;
}

/** The inverse of {@link parseFilters}, leaving defaults out so URLs stay short. */
export function formatFilters(filters: BuildFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const kind of FACET_KINDS) {
    const values = filters.facets[kind];
    if (values !== undefined && values.length > 0) params.set(kind, values.join(","));
  }
  if (filters.levelMin !== undefined) params.set("levelMin", String(filters.levelMin));
  if (filters.levelMax !== undefined) params.set("levelMax", String(filters.levelMax));
  if (filters.q) params.set("q", filters.q);
  if (filters.sort !== "new") params.set("sort", filters.sort);
  if (filters.page !== 1) params.set("page", String(filters.page));
  return params;
}

/** Add or remove one facet value, going back to page 1 as any change of filter should. */
export function toggleFacet(filters: BuildFilters, kind: FacetKind, value: string): BuildFilters {
  const current = filters.facets[kind] ?? [];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  const facets = { ...filters.facets };
  if (next.length === 0) delete facets[kind];
  else facets[kind] = next;
  return { ...filters, facets, page: 1 };
}

function wholeNumber(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}
