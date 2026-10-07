/**
 * Which skill the build's DPS is about. An in-game export doesn't say, so this suggests the
 * skill with the highest DPS (computed here, with the engine) and the uploader can change it.
 */

import { isSkillEnabled, type BuildDoc } from "@cte2/schema";
import { rankSkills, type SkillDps } from "@cob/shared/skill-dps";
import { compact } from "@cte2/view";
import { useEffect, useMemo, type ReactNode } from "react";

import { useGame } from "../game-data.tsx";
import { nameOf } from "../names.tsx";

export function MainSkillPicker({
  doc,
  value,
  onChange,
}: {
  doc: BuildDoc;
  /** Index into `doc.skills`; undefined until there's something to suggest. */
  value: number | undefined;
  onChange: (index: number) => void;
}): ReactNode {
  const game = useGame();
  const ranked = useMemo((): SkillDps[] | null => {
    if (game === null) return null;
    try {
      return rankSkills(doc, game.snapshot);
    } catch {
      return [];
    }
  }, [doc, game]);
  const best = ranked?.[0] !== undefined && ranked[0].dps > 0 ? ranked[0] : undefined;

  // Nothing marked, so take the suggestion as soon as there is one.
  useEffect(() => {
    if (value === undefined && best !== undefined) onChange(best.index);
  }, [value, best, onChange]);

  const skills = (doc.skills ?? []).map((skill, index) => ({ skill, index })).filter(({ skill }) => isSkillEnabled(skill));
  if (skills.length === 0) return null;
  const dpsOf = (index: number) => ranked?.find((r) => r.index === index)?.dps;

  return (
    <label>
      Main skill
      <select value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))}>
        {value === undefined ? <option value="">{game === null ? "Working out DPS…" : "Pick one"}</option> : null}
        {skills.map(({ skill, index }) => {
          const dps = dpsOf(index);
          return (
            <option key={index} value={index}>
              {nameOf(game, "skill", skill.spellId)}
              {dps === undefined ? "" : ` · ${compact(dps)} DPS`}
              {best?.index === index ? " (highest)" : ""}
            </option>
          );
        })}
      </select>
      <span className="faint">The DPS shown for this build is this skill's. The highest is picked unless you choose another.</span>
    </label>
  );
}
