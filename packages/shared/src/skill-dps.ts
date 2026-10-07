/**
 * Every enabled skill's DPS, for suggesting the main skill. Runs the engine once per skill, so
 * it lives behind its own entry point (`@cob/shared/skill-dps`) and the Worker never bundles it.
 */

import { damageRates, simulateDps } from "@cte2/engine";
import type { Snapshot } from "@cte2/extractor";
import { isSkillEnabled, mainStage, stageDoc, type BuildDoc } from "@cte2/schema";

export type SkillDps = {
  /** Index into `doc.skills`. */
  index: number;
  spellId: string;
  /** The skill's own figure with its procs, ailments and pets, as the top bar adds them up. */
  dps: number;
};

/** The enabled skills on the build's main stage with their DPS, highest first. */
export function rankSkills(doc: BuildDoc, snapshot: Snapshot): SkillDps[] {
  const main = mainStage(doc);
  const at = main === undefined ? doc : stageDoc(doc, main);
  // Asked as a skill rather than as the swing, whatever the document's own setting.
  const asked: BuildDoc = { ...at, config: { ...(at.config ?? {}), mainIsBasicAttack: false } };
  const out: SkillDps[] = [];
  (doc.skills ?? []).forEach((skill, index) => {
    if (!isSkillEnabled(skill)) return;
    let dps = 0;
    try {
      const total = damageRates({ dps: simulateDps(asked, snapshot, { skill }), fullDps: undefined }).total;
      if (Number.isFinite(total)) dps = total;
    } catch {
      // A skill the engine can't compute is offered at 0 rather than hidden.
    }
    out.push({ index, spellId: skill.spellId, dps });
  });
  // Stable, so a tie goes to the earlier skill on the bar.
  return out.sort((a, b) => b.dps - a.dps);
}

/** The skill to suggest as main: the highest DPS, if any skill deals damage. */
export function bestSkill(doc: BuildDoc, snapshot: Snapshot): SkillDps | undefined {
  const top = rankSkills(doc, snapshot)[0];
  return top !== undefined && top.dps > 0 ? top : undefined;
}
