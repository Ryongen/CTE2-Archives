/**
 * `POST /builds`: turn whatever was uploaded into rows.
 *
 * Only the cheap part happens here. `summarizeBuild` reads the pack's small index rather than its
 * snapshot, so the facets exist the moment a build lands; validation and the engine's numbers
 * need the full snapshot and are left to the indexer, which marks the build `indexed` or
 * `invalid` once it has run.
 */

import {
  mainStage,
  readBuild,
  readBuildText,
  samePackVersion,
  stageDoc,
  stageList,
  summaryFacets,
  type BuildDoc,
  type BuildSummary,
  type Facet,
  type IndexData,
  type ReadBuild,
} from "@cte2/schema";
import { catalogueSummary, normaliseVersion, type UploadRequest, type Visibility } from "@cob/shared";

export class UploadError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 413 | 429 | 503 = 400,
  ) {
    super(message);
  }
}

export type PreparedStage = {
  stageId: string;
  position: number;
  name: string;
  level: number | null;
  isMain: boolean;
  mainSkill: string | null;
};

export type PreparedBuild = {
  doc: BuildDoc;
  observed: ReadBuild["observed"];
  title: string;
  notes: string;
  visibility: Visibility;
  summary: BuildSummary;
  facets: Facet[];
  stages: PreparedStage[];
  mnsVersion: string | null;
  packVersion: string | null;
};

export const MAX_TITLE = 100;
export const MAX_NOTES = 20_000;
export const MAX_PACK_VERSION = 40;

/** Read the request body's `build` field into a document, whichever form it came in. */
export async function readUpload(build: UploadRequest["build"]): Promise<ReadBuild> {
  try {
    return typeof build === "string" ? await readBuildText(build) : readBuild(build);
  } catch (error) {
    throw new UploadError(error instanceof Error ? error.message : "Not a build");
  }
}

/**
 * The pack a document belongs to: the one its recorded version names, or else the newest. A
 * build with no version, or one from a pack the catalogue hasn't loaded, is still summarised;
 * perk coordinates rarely move between packs, and the indexer re-checks against the real one.
 */
export function choosePack<P extends { mnsVersion: string }>(doc: BuildDoc, packs: readonly P[]): P | undefined {
  const wanted = doc.meta?.mineAndSlashVersion;
  return packs.find((p) => samePackVersion(p.mnsVersion, wanted)) ?? packs[0];
}

export function prepareBuild(read: ReadBuild, request: UploadRequest, index: IndexData): PreparedBuild {
  const { doc, observed } = read;
  const main = mainStage(doc);
  // Summarise the stage the build is about, not whichever one happened to be open.
  const summary = catalogueSummary(main === undefined ? doc : stageDoc(doc, main), index);
  const mainId = main?.id;

  const stages = stageList(doc).map((stage, position): PreparedStage => {
    const level = stage.level ?? null;
    return {
      stageId: stage.id,
      position,
      name: clip(stage.name, MAX_TITLE) || `Stage ${position + 1}`,
      level,
      isMain: mainId === undefined ? stage.main === true : stage.id === mainId,
      mainSkill: catalogueSummary(stageDoc(doc, stage), index).mainSkill ?? null,
    };
  });

  return {
    doc,
    observed,
    title: clip(request.title ?? "", MAX_TITLE) || clip(doc.meta?.name ?? "", MAX_TITLE) || `Level ${summary.level} build`,
    notes: clip(request.notes ?? "", MAX_NOTES),
    visibility: request.visibility === "unlisted" ? "unlisted" : "public",
    summary,
    facets: summaryFacets(summary),
    stages,
    mnsVersion: normaliseVersion(doc.meta?.mineAndSlashVersion),
    // The exporter can't see the modpack's version, so the uploader may say it instead.
    packVersion: clip(packVersionOf(doc.meta?.packVersion) ?? packVersionOf(request.packVersion) ?? "", MAX_PACK_VERSION) || null,
  };
}

/**
 * What identifies a build for de-duplication: the document alone, so the same build uploaded
 * twice with different titles is still one build.
 */
export function contentKey(doc: BuildDoc): string {
  return JSON.stringify(doc);
}

export function packVersionOf(version: string | undefined): string | undefined {
  const v = version?.trim();
  return v === undefined || v === "" || v.toLowerCase() === "unknown" ? undefined : v;
}

export function clip(text: string, max: number): string {
  return text.trim().slice(0, max);
}
