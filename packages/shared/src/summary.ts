/**
 * The summary the catalogue keeps for a build. The upload endpoint writes it from the pack's small
 * index and the indexer rewrites it with the engine's main skill, so both go through here and
 * can't disagree about what a facet is.
 */

import {
  packModVersion,
  summarizeBuild,
  type BuildDoc,
  type BuildSummary,
  type IndexData,
} from "@cte2/schema";

/**
 * `summarizeBuild`, minus the atlas tree's majors: people search for builds by their talent and
 * ascendancy keystones, and the atlas is map progression, not part of what a build is.
 */
export function catalogueSummary(doc: BuildDoc, index: IndexData, options: { mainSkill?: string } = {}): BuildSummary {
  const summary = summarizeBuild(doc, index, options);
  const atlas = new Set(Object.values(index.trees.atlas ?? {}));
  if (atlas.size === 0) return summary;
  return { ...summary, keystones: summary.keystones.filter((id) => !atlas.has(id)) };
}

/**
 * A recorded Mine and Slash version in the one spelling the catalogue stores and filters on,
 * `6.4.13` rather than `1.20.1-6.4.13`. The exporter writes `unknown` when it couldn't tell,
 * which is the same as not saying.
 */
export function normaliseVersion(version: string | null | undefined): string | null {
  if (version === null || version === undefined) return null;
  const v = packModVersion(version);
  return v === "" || v.toLowerCase() === "unknown" ? null : v;
}
