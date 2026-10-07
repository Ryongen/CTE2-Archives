/**
 * Which skill a build's damage figures are about. An in-game export never says (the exporter
 * leaves that choice to the player), so the site asks at upload and on the edit page, and
 * suggests the skill with the highest DPS (`skill-dps.ts`).
 */

import { isSkillEnabled, type BuildDoc } from "@cte2/schema";

/** The index of the enabled skill marked `main`, if there is one. */
export function markedMainSkill(doc: BuildDoc): number | undefined {
  if (doc.config?.mainIsBasicAttack === true) return undefined;
  const at = (doc.skills ?? []).findIndex((s) => s.main === true && isSkillEnabled(s));
  return at < 0 ? undefined : at;
}

/** Whether `index` names an enabled skill of `doc`, so it can be made the main one. */
export function canBeMainSkill(doc: BuildDoc, index: unknown): index is number {
  if (typeof index !== "number" || !Number.isInteger(index)) return false;
  const skill = doc.skills?.[index];
  return skill !== undefined && isSkillEnabled(skill);
}

/**
 * `doc` with skill `index` as the main one and no other. Picking a skill also turns off
 * CoB's "the swing is the main figure", which would otherwise ignore every `main` flag.
 */
export function withMainSkill(doc: BuildDoc, index: number): BuildDoc {
  const skills = (doc.skills ?? []).map((skill, i) => {
    const { main: _, ...rest } = skill;
    return i === index ? { ...rest, main: true } : rest;
  });
  const next: BuildDoc = { ...doc, skills };
  if (doc.config?.mainIsBasicAttack !== undefined) {
    const { mainIsBasicAttack: _, ...config } = doc.config;
    next.config = config;
  }
  return next;
}
