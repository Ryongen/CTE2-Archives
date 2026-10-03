/**
 * The column of numbers down the right of a build, as CoB's sidebar has it: the main skill, the
 * attributes, then survival.
 *
 * Ported from CoB's `panels/stats/VitalsBlock.tsx`, without the click-through breakdowns (the
 * catalogue has no detail pane; "Open in CoB" is the way to those). Every figure comes out of
 * the one `deriveBuild` the page already ran, so this is a render, not another pass.
 */

import type { DerivedBuild } from "@cte2/engine";
import { SINGLE_ELEMENTS, statDisplay, statName, type ElementName } from "@cte2/schema";
import {
  elementColour,
  elementLabel,
  isOverCap,
  num,
  overCap,
  smart,
  StatIcon,
  statLook,
  usable,
  USABLE_NOUN,
  useWorld,
} from "@cte2/view";
import { useState, type ReactNode } from "react";

const RESIST_OF: Record<string, string> = {
  fire: "fire_resist",
  water: "water_resist",
  lightning: "lightning_resist",
  chaos: "chaos_resist",
};

export function StatsSidebar({ derived }: { derived: DerivedBuild }): ReactNode {
  return (
    <aside className="panel stats-sidebar">
      <div className="vitals">
        <SkillVitals derived={derived} />
        <div className="vitals-group">
          <div className="vitals-title">Attributes</div>
          <StatRow derived={derived} statId="strength" />
          <StatRow derived={derived} statId="intelligence" />
          <StatRow derived={derived} statId="dexterity" />
        </div>
        <Survival derived={derived} />
      </div>
    </aside>
  );
}

function SkillVitals({ derived }: { derived: DerivedBuild }): ReactNode {
  const { snapshot } = useWorld();
  const { dps, damage, fullDps } = derived;
  if (derived.doc.config?.mainIsBasicAttack === true && derived.basic !== undefined) {
    return <SwingVitals derived={derived} />;
  }
  if (dps === undefined || damage === undefined) {
    return (
      <div className="vitals-group">
        <div className="vitals-title">Main skill</div>
        <div className="faint small">No skill set, so there is no hit to report.</div>
      </div>
    );
  }

  const { rate, cost } = dps;
  const swingProcDps = derived.basic?.procDps ?? 0;
  const perSecond = rate.cycleSeconds > 0 ? 1 / rate.cycleSeconds : 0;
  const critMulti = damage.hit.total > 0 ? damage.crit.total / damage.hit.total : 0;
  const critDamage = derived.skillBreakdown("critical_damage")?.stat;
  const spend =
    cost.manaPerCast > 0
      ? { pool: cost.manaSpentAs, perCast: cost.manaPerCast, perSecond: cost.manaPerSecond }
      : cost.energyPerCast > 0
        ? { pool: cost.energySpentAs, perCast: cost.energyPerCast, perSecond: cost.energyPerSecond }
        : undefined;

  return (
    <div className="vitals-group">
      <div className="vitals-title">Main skill</div>
      <Row
        label="Hit"
        statId="total_damage"
        value={smart(damage.average.total)}
        hint={`Average of ${smart(damage.hit.total)} non-crit and ${smart(damage.crit.total)} crit, weighted by crit chance.`}
      />
      {dps.ailmentHit > 0 ? (
        <Row
          label="Ailment hit"
          statId="ailment_damage"
          value={smart(dps.ailmentHit)}
          hint="What a Shatter or Shock releases. The hit that triggers it lands too."
        />
      ) : null}
      <Row
        label={rate.channelled ? "Pulse rate" : "Cast rate"}
        statId="cast_speed"
        value={`${num(perSecond, 2)}/s`}
        hint={
          `One cycle is ${num(rate.cycleSeconds, 2)}s: ${num(rate.castSeconds, 2)}s casting plus ` +
          `${num(rate.cooldownSeconds, 2)}s ${rate.chargeBased ? "charge regeneration" : "recovery"}` +
          (rate.castsPerCycle > 1 ? `, firing ${rate.castsPerCycle} times` : "") +
          "."
        }
      />
      <Row label="Crit chance" statId="critical_hit" value={`${num(damage.critChance * 100, 2)}%`} hint="This skill's own crit chance, support gems included." />
      <Row
        label="Crit damage"
        statId="critical_damage"
        value={critDamageValue(critDamage, critMulti)}
        hint={`A crit here lands for ${num(critMulti, 2)}× a non-crit.`}
      />
      <Row label="Chance to hit" statId="accuracy" value={`${num(damage.hitChance * 100, 2)}%`} hint="Already folded into the damage figures." />
      <Row label="Hit DPS" statId="total_damage" value={smart(dps.dps)} hint="This skill, on its own button." />
      <Row
        label="Ailment DPS"
        statId="ailment_damage"
        value={smart(dps.ailmentDps - dps.ailmentProcDps)}
        hint="Bleed, ignite, poison and the rest, on their own clock."
      />
      {dps.ailmentProcDps > 0 ? <Row label="Ailment hit DPS" statId="ailment_damage" value={smart(dps.ailmentProcDps)} /> : null}
      <Row
        label="Combined DPS"
        statId="total_damage"
        value={smart(dps.dps + dps.ailmentDps)}
        strong
        hint="Hits, ailments and Shatter/Shock from this skill alone. Procs, summons and weapon swings are in Total DPS."
      />
      {fullDps !== undefined && fullDps.dps > 0 ? (
        <Row
          label="Full DPS"
          statId="total_damage"
          value={smart(fullDps.dps + fullDps.ailmentDps + swingProcDps)}
          strong
          hint={`Every skill in the rotation, cast once each per ${num(fullDps.rotationSeconds, 2)}s pass, with what they proc.`}
        />
      ) : null}
      {spend === undefined ? (
        <Row label="Cost" value="free" hint="This skill declares no mana or energy cost." />
      ) : (
        <>
          <Row label={`${statName(snapshot, spend.pool)} cost`} statId={spend.pool} value={smart(spend.perCast)} hint="Per cast, support gem multipliers included." />
          <Row
            indent
            label="Cost per second"
            value={`${smart(spend.perSecond)}/s`}
            tone={cost.sustainable ? undefined : "bad"}
            hint={cost.sustainable ? "Regeneration covers it." : "More than regeneration covers, so it can't be kept up."}
          />
        </>
      )}
    </div>
  );
}

function SwingVitals({ derived }: { derived: DerivedBuild }): ReactNode {
  const basic = derived.basic!;
  const hit = basic.hit;
  const critMulti = hit.hit.total > 0 ? hit.crit.total / hit.hit.total : 0;
  return (
    <div className="vitals-group">
      <div className="vitals-title">Main skill: basic attack</div>
      <Row label="Hit" statId="total_damage" value={smart(hit.average.total)} />
      <Row
        label="Swing rate"
        statId="attack_speed"
        value={basic.swingsPerSecond === undefined ? "—" : `${num(basic.swingsPerSecond, 2)}/s`}
      />
      <Row label="Crit chance" statId="critical_hit" value={`${num(hit.critChance * 100, 2)}%`} />
      <Row label="Crit damage" statId="critical_damage" value={critDamageValue(derived.stats.get("critical_damage"), critMulti)} />
      <Row label="Chance to hit" statId="accuracy" value={`${num(hit.hitChance * 100, 2)}%`} />
      <Row label="Swing DPS" statId="total_damage" value={smart(basic.dps)} />
      <Row label="Proc DPS" statId="total_damage" value={smart(basic.procDps)} />
      {basic.ailmentDps > 0 ? <Row label="Ailment DPS" statId="ailment_damage" value={smart(basic.ailmentDps)} /> : null}
      <Row label="Combined DPS" value={smart(basic.dps + basic.procDps + basic.ailmentDps)} strong />
    </div>
  );
}

function Survival({ derived }: { derived: DerivedBuild }): ReactNode {
  const { defence, resources, dps } = derived;
  const [showElements, setShowElements] = useState(false);

  const spentAs =
    dps === undefined
      ? undefined
      : dps.cost.manaPerCast > 0
        ? dps.cost.manaSpentAs
        : dps.cost.energyPerCast > 0
          ? dps.cost.energySpentAs
          : undefined;
  const pools = resources.byResource.filter((r) => r.resource !== "health" && r.resource !== "magic_shield");
  const main = pools.find((r) => r.resource === spentAs) ?? [...pools].sort((a, b) => b.max - a.max)[0];
  const magicShield = resources.byResource.find((r) => r.resource === "magic_shield");
  const health = resources.byResource.find((r) => r.resource === "health");
  const elements = orderedElements(defence.byElement);

  return (
    <div className="vitals-group">
      <div className="vitals-title">Survival</div>
      <Row
        label="Effective HP"
        statId="health"
        value={smart(defence.weakest.effectiveHealth)}
        strong
        caret={showElements ? "open" : "closed"}
        onToggle={() => setShowElements((v) => !v)}
        hint={`Against ${defence.weakest.element}, your weakest element. Click the arrow for the rest.`}
      />
      {showElements
        ? elements.map((e) => (
            <Row
              key={e.element}
              indent
              label={elementLabel(e.element)}
              colour={elementColour(e.element)}
              value={smart(e.effectiveHealth)}
              tone={e.element === defence.weakest.element ? "bad" : undefined}
              hint={`${num(e.taken * 100, 2)}% of a ${e.element} hit reaches your pools.`}
            />
          ))
        : null}
      <Row
        label="Maximum hit"
        statId="dmg_reduction"
        value={smart(defence.mostFragile.maximumHit)}
        strong
        hint={`The largest single ${defence.mostFragile.element} hit survived from full, with every dodge and block roll failing.`}
      />
      {showElements
        ? elements.map((e) => (
            <Row
              key={`max-${e.element}`}
              indent
              label={elementLabel(e.element)}
              colour={elementColour(e.element)}
              value={smart(e.maximumHit)}
              tone={e.element === defence.mostFragile.element ? "bad" : undefined}
            />
          ))
        : null}

      <StatRow derived={derived} statId="health" />
      {health !== undefined ? (
        <Row indent label="Regeneration" value={`${num(health.inCombatPerSecond, 2)}/s`} hint={`${num(health.perSecond, 2)}/s out of combat.`} />
      ) : null}
      {main !== undefined ? (
        <>
          <StatRow derived={derived} statId={main.resource} value={smart(main.max)} />
          <Row indent label="Regeneration" value={`${num(main.perSecond, 2)}/s`} hint={`${num(main.inCombatPerSecond, 2)}/s in combat.`} />
        </>
      ) : null}
      <StatRow derived={derived} statId="magic_shield" value={smart(defence.pools.magicShield)} />
      {magicShield !== undefined ? (
        <Row indent label="Regeneration" value={`${num(magicShield.perSecond, 2)}/s`} hint={`${num(magicShield.inCombatPerSecond, 2)}/s in combat.`} />
      ) : null}

      <StatRow derived={derived} statId="armor" />
      <StatRow derived={derived} statId="physical_resist" />
      <StatRow derived={derived} statId="dodge" />
      <StatRow derived={derived} statId="dmg_reduction_chance" />
      <StatRow derived={derived} statId="block_chance" />
      {SINGLE_ELEMENTS.map((element) => {
        const statId = RESIST_OF[element.guid];
        return statId === undefined ? null : <StatRow key={statId} derived={derived} statId={statId} />;
      })}
      <StatRow derived={derived} statId="move_speed" />
    </div>
  );
}

/** A sheet stat, named and formatted as the sheet does it. A stat nothing grants reads 0. */
function StatRow({ derived, statId, value: override }: { derived: DerivedBuild; statId: string; value?: string }): ReactNode {
  const { snapshot } = useWorld();
  const stat = derived.stats.get(statId);
  const rawIsPercent = statDisplay(snapshot, statId).isPerc;
  const value =
    override ??
    (stat === undefined
      ? smart(0)
      : stat.usableValue !== undefined
        ? usable(stat.usableValue, stat.value, rawIsPercent)
        : isOverCap(stat)
          ? overCap(stat.value, stat.uncapped!, rawIsPercent)
          : smart(stat.value));
  const hint =
    stat === undefined
      ? "Nothing in this build grants it."
      : stat.usableValue !== undefined
        ? `${smart(stat.usableValue)}% ${USABLE_NOUN[statId] ?? "effective"}`
        : isOverCap(stat)
          ? `${smart(stat.uncapped!)}, capped at ${smart(stat.value)}.`
          : undefined;
  return <Row label={statName(snapshot, statId)} statId={statId} value={value} hint={hint} />;
}

function critDamageValue(stat: { value: number; uncapped?: number } | undefined, ratio: number): string {
  if (stat === undefined) return `${num(ratio, 2)}×`;
  return isOverCap(stat) ? overCap(stat.value, stat.uncapped!, true) : `${smart(stat.value)}%`;
}

function Row({
  label,
  statId,
  colour,
  value,
  hint,
  strong = false,
  indent = false,
  tone,
  caret,
  onToggle,
}: {
  label: string;
  statId?: string;
  colour?: string;
  value: string;
  hint?: string | undefined;
  strong?: boolean;
  indent?: boolean;
  tone?: "bad" | undefined;
  caret?: "open" | "closed";
  onToggle?: () => void;
}): ReactNode {
  const { snapshot } = useWorld();
  // Only tint a label whose stat has a colour of its own; `var(--text)` means it has none.
  const identity = statId === undefined ? undefined : statLook(snapshot, statId).colour;
  const tint = colour ?? (identity === "var(--text)" ? undefined : identity);
  return (
    <div
      className={`vitals-row${strong ? " strong" : ""}${indent ? " indent" : ""}${onToggle ? " pick" : ""}`}
      title={hint}
      onClick={onToggle}
    >
      {caret !== undefined ? <span className="vitals-caret">{caret === "open" ? "▾" : "▸"}</span> : null}
      {statId !== undefined ? <StatIcon statId={statId} size={13} /> : null}
      <span className="vitals-label" style={tint === undefined ? undefined : { color: tint }}>
        {label}
      </span>
      <span className={`vitals-value${tone === "bad" ? " bad" : ""}`}>{value}</span>
    </div>
  );
}

function orderedElements<T extends { element: ElementName }>(entries: readonly T[]): T[] {
  const rank = new Map(SINGLE_ELEMENTS.map((e, i) => [e.name, i]));
  return [...entries].sort((a, b) => (rank.get(a.element) ?? 99) - (rank.get(b.element) ?? 99));
}
