/**
 * One build's numbers: every stage through the engine, as `build_derived` rows, and the summary
 * redone with the engine's own main skill. The Worker can't afford any of this (10 ms of CPU),
 * so it happens here and the result is sent back.
 */

import { damageRates, deriveBuild, type DerivedBuild } from "@cte2/engine";
import type { Snapshot } from "@cte2/extractor";
import { mainStage, stageDoc, stageList, type BuildDoc, type IndexData } from "@cte2/schema";
import { catalogueSummary, type DerivedRequest, type DerivedStage } from "@cob/shared";

export function deriveForCatalogue(doc: BuildDoc, snapshot: Snapshot, index: IndexData): DerivedRequest {
  const main = mainStage(doc);
  const stages: DerivedStage[] = [];
  let mainDerived: DerivedBuild | undefined;
  try {
    for (const stage of stageList(doc)) {
      const derived = deriveBuild(stageDoc(doc, stage), snapshot);
      stages.push(stageRow(stage.id, derived));
      if (main === undefined || stage.id === main.id) mainDerived ??= derived;
    }
  } catch (error) {
    return { status: "invalid", reason: error instanceof Error ? error.message : String(error) };
  }

  const mainDoc = main === undefined ? doc : stageDoc(doc, main);
  const mainSkill = mainDerived?.dps?.spellId;
  return {
    status: "indexed",
    snapshotPack: snapshot.meta.mineAndSlashVersion,
    summary: catalogueSummary(mainDoc, index, mainSkill === undefined ? {} : { mainSkill }),
    stages,
  };
}

/** The same figures, composed the same way, as the build page's and CoB's own top bar. */
function stageRow(stageId: string, derived: DerivedBuild): DerivedStage {
  const rates = damageRates({
    dps: derived.dps,
    fullDps: derived.fullDps,
    basicDps: derived.basic?.dps ?? 0,
    basicProcDps: derived.basic?.procDps ?? 0,
  });
  const { pools, weakest, byElement } = derived.defence;
  return {
    stageId,
    dps: finite(rates.total),
    fullDps: finite(rates.primaryDps),
    ehp: finite(weakest.effectiveHealth),
    life: finite(pools.health),
    es: finite(pools.magicShield),
    mana: null,
    resFire: null,
    resCold: null,
    resLight: null,
    resChaos: null,
    json: {
      legal: derived.legal,
      problems: derived.diagnostics.filter((d) => d.severity === "error").length,
      mainSkill: derived.dps?.spellId ?? null,
      weakest: weakest.element,
      ehpByElement: Object.fromEntries(byElement.map((e) => [e.element, finite(e.effectiveHealth)])),
      rates,
    },
  };
}

/** D1 has no NaN or Infinity, and a number that broke shouldn't sort to the top. */
function finite(n: number): number | null {
  return Number.isFinite(n) ? n : null;
}
