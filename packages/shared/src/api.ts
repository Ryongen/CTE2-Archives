/**
 * The catalogue API's request and response shapes. The Worker produces these and the site reads
 * them, so a field renamed on one side and not the other is a type error rather than a blank cell.
 */

import type { BuildSummary, FacetKind } from "@cte2/schema";

export type BuildKind = "planned" | "capture";
export type BuildSource = "web" | "cob" | "bot" | "mod" | "server";
export type Visibility = "public" | "unlisted";
export type BuildStatus = "pending" | "indexed" | "invalid" | "hidden";

/** Uploads larger than this are refused before they are parsed. */
export const MAX_UPLOAD_BYTES = 256 * 1024;

export type UploadRequest = {
  /** A build code, the JSON text of a document or capture, or the parsed object. */
  build: string | object;
  title?: string;
  notes?: string;
  visibility?: Visibility;
  /** Turnstile response token; required when the API has a Turnstile secret configured. */
  turnstileToken?: string;
};

export type UploadResponse =
  /** `editToken` is shown once and only its hash is kept: lose it and the build can't be edited. */
  | { id: string; duplicate: false; editToken: string }
  /** The same document was uploaded before; this is that build. */
  | { id: string; duplicate: true };

/** One row of the list. Ids, not names: the site names them against the snapshot it holds. */
export type BuildRow = {
  id: string;
  kind: BuildKind;
  source: BuildSource;
  verified: boolean;
  title: string;
  level: number;
  ascendancy: string | null;
  mainSkill: string | null;
  mnsVersion: string | null;
  uniques: string[];
  status: BuildStatus;
  createdAt: string;
  derived: DerivedHeadline | null;
};

/** The numbers a list row shows. Filled in by the indexer; null until it has run. */
export type DerivedHeadline = {
  dps: number | null;
  ehp: number | null;
  life: number | null;
  es: number | null;
};

export type FacetCount = { value: string; count: number };

export type BuildListResponse = {
  rows: BuildRow[];
  total: number;
  page: number;
  pageSize: number;
  /** Per kind, the most common values in the filtered set. See `GET /builds` for how. */
  facets: Partial<Record<FacetKind, FacetCount[]>>;
};

export type BuildStageRow = {
  stageId: string;
  name: string;
  level: number | null;
  isMain: boolean;
  mainSkill: string | null;
};

export type BuildDetail = BuildRow & {
  notes: string;
  packVersion: string | null;
  updatedAt: string;
  summary: BuildSummary;
  stages: BuildStageRow[];
  /** Whether the build arrived as a capture carrying the game's own stat sheet. */
  hasObserved: boolean;
};

export type ApiError = { error: string };
