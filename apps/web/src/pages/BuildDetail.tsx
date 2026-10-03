/**
 * One build. The numbers are computed here, in the browser, with the same `deriveBuild` CoB runs,
 * so what this page says and what CoB says about the same document cannot disagree.
 */

import { balance, damageRates, deriveBuild, spellRanks, type DerivedBuild } from "@cte2/engine";
import type { Snapshot } from "@cte2/extractor";
import {
  activeSupportLinks,
  baseGearType,
  CATEGORY,
  countOmenPieces,
  entry,
  gearRarity,
  learnedSpells,
  maxBonusSpellLevels,
  isAuraEnabled,
  isSkillEnabled,
  itemName,
  jewelItemId,
  jewelName,
  nodeKey,
  omenBuckets,
  omenName,
  perkName,
  slotName,
  stageDoc,
  stageList,
  text,
  TREE_KEYS,
  uniqueName,
  WATCHER_EYE_UNIQUE,
  wornItems,
  type BuildDoc,
  type BuildStage,
  type TreeKey,
} from "@cte2/schema";
import {
  auraCard,
  compact,
  perkCard,
  spellCard,
  supportGemCard,
  TreeCanvas,
  useHoverCard,
  useWorld,
  type At,
  type HoverInfo,
} from "@cte2/view";
import { legalityOf } from "@cob/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router";

import { api } from "../api.ts";
import { OpenInCob } from "../components/OpenInCob.tsx";
import { StatsSidebar } from "../components/StatsSidebar.tsx";
import { GemWindow, ItemWindow, JewelWindow, OmenWindow, SpellWindow } from "../components/Tooltips.tsx";
import { ago, versionLabel } from "../format.ts";
import { useGame, WhenLoaded } from "../game-data.tsx";
import { nameOf, Thing, ThingIcon } from "../names.tsx";

export function BuildDetailPage(): ReactNode {
  const { id = "" } = useParams();
  const detail = useQuery({ queryKey: ["build", id], queryFn: () => api.build(id) });
  const doc = useQuery({ queryKey: ["doc", id], queryFn: () => api.doc(id), staleTime: Infinity });
  const game = useGame();

  const stages = useMemo(() => (doc.data === undefined ? [] : stageList(doc.data)), [doc.data]);
  const mainId = detail.data?.stages.find((s) => s.isMain)?.stageId;
  const [picked, setPicked] = useState<string | null>(null);
  const stage = stages.find((s) => s.id === (picked ?? mainId)) ?? stages[0];
  const shown = useMemo(
    () => (doc.data === undefined || stage === undefined ? undefined : stageDoc(doc.data, stage)),
    [doc.data, stage],
  );

  if (detail.error) return <p className="error">{detail.error.message}</p>;
  if (detail.data === undefined || doc.data === undefined || shown === undefined) return <p className="empty">Loading…</p>;
  const build = detail.data;

  return (
    <div className="detail">
      <header className="detail-head">
        {build.ascendancy === null ? null : <ThingIcon kind="ascendancy" id={build.ascendancy} size={56} />}
        <div className="grow">
          <h1>{build.title}</h1>
          <p className="faint">
            Level {shown.character.level}
            {build.ascendancy === null ? "" : ` ${nameOf(game, "ascendancy", build.ascendancy)}`}
            {build.mainSkill === null ? "" : ` · ${nameOf(game, "skill", build.mainSkill)}`}
            {" "}· uploaded {ago(build.createdAt)}
            <span className="badge version" title="The game version this build was made on">
              {versionLabel(build.mnsVersion, build.packVersion)}
            </span>
            {build.kind === "capture" ? <span className="badge capture">In-game capture</span> : <span className="badge planned">Planned</span>}
          </p>
        </div>
        <OpenInCob id={build.id} doc={doc.data} title={build.title} />
      </header>

      {stages.length > 1 ? <StagePicker stages={stages} current={stage?.id} mainId={mainId} onPick={setPicked} /> : null}

      <WhenLoaded fallback={<p className="empty">Loading game data…</p>}>
        <BuildBody doc={shown} notes={build.notes} />
      </WhenLoaded>
    </div>
  );
}

/**
 * Everything that needs the game data. One `deriveBuild` run feeds the headline figures, the
 * sidebar, the skill ranks on the skill cards and the attribute checks on the item cards.
 */
function BuildBody({ doc, notes }: { doc: BuildDoc; notes: string }): ReactNode {
  const { snapshot } = useWorld();
  const derived = useMemo((): DerivedBuild | Error => {
    try {
      return deriveBuild(doc, snapshot);
    } catch (error) {
      return error instanceof Error ? error : new Error(String(error));
    }
  }, [doc, snapshot]);
  const ok = derived instanceof Error ? undefined : derived;

  return (
    <>
      {derived instanceof Error ? <p className="error">CoB couldn't compute this build: {derived.message}</p> : <Numbers derived={derived} />}
      {ok === undefined ? null : <Checks doc={doc} derived={ok} />}
      <div className="detail-body">
        <div className="detail-main">
          <div className="columns">
            <section className="panel">
              <h2>Skills</h2>
              <Skills doc={doc} derived={ok} />
            </section>
            <section className="panel">
              <h2>Equipment</h2>
              <Gear doc={doc} derived={ok} />
            </section>
          </div>

          <TreePanel doc={doc} />

          {notes ? (
            <section className="panel">
              <h2>Notes</h2>
              <p className="notes">{notes}</p>
            </section>
          ) : null}
        </div>
        {ok === undefined ? null : <StatsSidebar derived={ok} />}
      </div>
    </>
  );
}

function StagePicker({
  stages,
  current,
  mainId,
  onPick,
}: {
  stages: BuildStage[];
  current: string | undefined;
  mainId: string | undefined;
  onPick: (id: string) => void;
}): ReactNode {
  return (
    <nav className="tabs">
      {stages.map((s) => (
        <button key={s.id} className={s.id === current ? "on" : ""} onClick={() => onPick(s.id)}>
          {s.name}
          {s.level === undefined ? "" : ` (${s.level})`}
          {s.id === mainId ? " ★" : ""}
        </button>
      ))}
    </nav>
  );
}

function Numbers({ derived }: { derived: DerivedBuild }): ReactNode {
  const rates = damageRates({
    dps: derived.dps,
    fullDps: derived.fullDps,
    basicDps: derived.basic?.dps ?? 0,
    basicProcDps: derived.basic?.procDps ?? 0,
  });
  const { pools, weakest } = derived.defence;
  const { errors, notMakeable } = legalityOf(derived.diagnostics);

  return (
    <div className="figures">
      <Figure label="Total DPS" value={compact(rates.total)} />
      <Figure label="EHP" value={compact(weakest.effectiveHealth)} hint={`against ${weakest.element}, your weakest element`} />
      <Figure label="Life" value={compact(pools.health)} />
      <Figure label="Magic shield" value={compact(pools.magicShield)} />
      <Figure
        label="Legality"
        value={derived.legal ? "Legal" : `${errors.length} problem${errors.length === 1 ? "" : "s"}`}
        tone={derived.legal ? "good" : "bad"}
        note={notMakeable.length === 0 ? undefined : "Can't be made in this version"}
      />
    </div>
  );
}

/**
 * What CoB's checks said, worded for someone copying the build. Errors make it illegal; the
 * "can't be made" warnings are items the game still honours but this pack won't craft again; the
 * rest is housekeeping and stays folded away.
 */
function Checks({ doc, derived }: { doc: BuildDoc; derived: DerivedBuild }): ReactNode {
  const { snapshot } = useWorld();
  const { errors, notMakeable, warnings } = legalityOf(derived.diagnostics);
  if (errors.length + notMakeable.length + warnings.length === 0) return null;

  // `gear[3].runeword` means little to a reader; the item's name does.
  const where = (path: string): string => {
    const m = /^(gear|itemPool|jewels)\[(\d+)\]/.exec(path);
    if (m === null) return path;
    const i = Number(m[2]);
    if (m[1] === "jewels") {
      const jewel = doc.jewels?.[i];
      return jewel === undefined ? path : jewelName(snapshot, jewel);
    }
    const item = (m[1] === "gear" ? doc.gear : doc.itemPool)?.[i];
    return item === undefined ? path : itemName(snapshot, item);
  };
  const list = (items: typeof errors): ReactNode => (
    <ul className="checks">
      {items.map((d, i) => (
        <li key={i} title={d.code}>
          <strong>{where(d.path)}</strong> {d.message}
        </li>
      ))}
    </ul>
  );

  return (
    <section className="panel">
      {errors.length > 0 ? (
        <>
          <h3 className="bad">Problems</h3>
          {list(errors)}
        </>
      ) : null}
      {notMakeable.length > 0 ? (
        <>
          <h3 className="warn">Can't be made in this version</h3>
          <p className="faint small">
            The game still applies these, so the build is legal, but the current pack won't craft them again.
          </p>
          {list(notMakeable)}
        </>
      ) : null}
      {warnings.length > 0 ? (
        <details>
          <summary className="faint small">
            {warnings.length} other note{warnings.length === 1 ? "" : "s"}
          </summary>
          {list(warnings)}
        </details>
      ) : null}
    </section>
  );
}

function Figure({
  label,
  value,
  hint,
  tone,
  note,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad";
  note?: string;
}): ReactNode {
  return (
    <div className="figure" title={hint}>
      <span className="label">{label}</span>
      <span className={`value ${tone ?? ""}`}>{value}</span>
      {note === undefined ? null : <span className="note">{note}</span>}
    </div>
  );
}

/** Puts a hover card on whatever it wraps. `render` only runs while the pointer is over it. */
function Hover({ render, children }: { render: ((at: At) => ReactNode) | undefined; children: ReactNode }): ReactNode {
  const tip = useHoverCard(render);
  return (
    <span className="hover" {...tip.props}>
      {children}
      {tip.node}
    </span>
  );
}

/** A gem's roll: the stored one, or the bottom of its rarity's band, as CoB reads it. */
function bandedRoll(snapshot: Snapshot, rollPercent: number | undefined, rarity: string | undefined): number {
  if (rollPercent !== undefined) return rollPercent;
  if (rarity === undefined) return 0;
  return gearRarity(snapshot, rarity)?.statPercents.min ?? 0;
}

function Skills({ doc, derived }: { doc: BuildDoc; derived: DerivedBuild | undefined }): ReactNode {
  const { snapshot } = useWorld();
  // The rank each spell is cast at, resolved as CoB's Skills tab does it: a pinned level, else
  // what the sheet gives (class allocation plus gear's bonus ranks), else the class allocation.
  const ranks = useMemo(
    () => (derived === undefined ? new Map<string, number>() : spellRanks(snapshot, derived.stats, balance(snapshot))),
    [snapshot, derived],
  );
  const learned = useMemo(() => learnedSpells(snapshot, doc), [snapshot, doc]);
  const skills = (doc.skills ?? []).filter(isSkillEnabled);
  const augments = (doc.auras ?? []).filter(isAuraEnabled);
  const level = doc.character.level;
  if (skills.length === 0 && augments.length === 0) return <p className="faint">No skills.</p>;
  return (
    <>
      <ul className="skills">
        {skills.map((skill, i) => (
          <li key={`${skill.spellId}-${i}`}>
            <SkillName
              spellId={skill.spellId}
              rank={skill.level ?? ranks.get(skill.spellId) ?? learned.get(skill.spellId) ?? 1}
              level={level}
            />
            {skill.main === true ? <span className="badge">Main</span> : null}
            <span className="supports">
              {activeSupportLinks(skill).map((link) => (
                <GemChip key={link.id} kind="support" id={link.id} roll={bandedRoll(snapshot, link.rollPercent, link.rarity)} level={level} />
              ))}
            </span>
          </li>
        ))}
      </ul>
      {augments.length > 0 ? (
        <>
          <h3>Augments</h3>
          <p className="supports">
            {augments.map((a) => (
              <GemChip key={a.id} kind="augment" id={a.id} roll={bandedRoll(snapshot, a.rollPercent, a.rarity)} level={level} />
            ))}
          </p>
        </>
      ) : null}
    </>
  );
}

function SkillName({ spellId, rank, level }: { spellId: string; rank: number; level: number }): ReactNode {
  const { snapshot } = useWorld();
  const card = useMemo(() => {
    const max = entry(snapshot, CATEGORY.spell, spellId)?.data["max_lvl"];
    const natural = typeof max === "number" ? max : 16;
    return spellCard(snapshot, spellId, {
      level: rank,
      natural,
      ceiling: natural + maxBonusSpellLevels(snapshot),
      characterLevel: level,
    });
  }, [snapshot, spellId, rank, level]);
  return (
    <Hover render={card === undefined ? undefined : (at) => <SpellWindow card={card} at={at} />}>
      <Thing kind="skill" id={spellId} size={24} titled={card === undefined} />
    </Hover>
  );
}

function GemChip({ kind, id, roll, level }: { kind: "support" | "augment"; id: string; roll: number; level: number }): ReactNode {
  const { snapshot } = useWorld();
  const card = useMemo(() => {
    const at = { rollPercent: roll, characterLevel: level };
    return kind === "support" ? supportGemCard(snapshot, id, at) : auraCard(snapshot, id, at);
  }, [snapshot, kind, id, roll, level]);
  return (
    <Hover render={card === undefined ? undefined : (at) => <GemWindow card={card} at={at} />}>
      <Thing kind={kind} id={id} size={16} titled={card === undefined} />
    </Hover>
  );
}

function Gear({ doc, derived }: { doc: BuildDoc; derived: DerivedBuild | undefined }): ReactNode {
  const world = useWorld();
  const { snapshot } = world;
  const game = useGame();
  const gear = doc.gear ?? [];
  const jewels = doc.jewels ?? [];
  // The Augments the build runs, which decide whether a Watcher's Eye line counts.
  const augments = useMemo(() => new Set((doc.auras ?? []).filter(isAuraEnabled).map((a) => a.id)), [doc.auras]);
  // The pack renames the omen to "Codex".
  const word = text(snapshot, "item.mmorpg.omen") ?? "Omen";
  const omen = doc.omen;
  const filled = useMemo(
    () => (omen === undefined ? 0 : countOmenPieces(snapshot, wornItems(snapshot, gear), omen, doc.character.level)),
    [snapshot, gear, omen, doc.character.level],
  );
  if (gear.length === 0 && jewels.length === 0 && omen === undefined) return <p className="faint">No gear.</p>;
  const needed = omen === undefined ? 0 : Math.min(...omenBuckets(snapshot, omen).map((b) => b.pieces));
  const omenIcon = omen === undefined ? null : world.icon("mmorpg:textures/gui/prophecy/omen.png");
  return (
    <>
    <ul className="gear">
      {omen === undefined ? null : (
        <li>
          <Hover render={(at) => <OmenWindow omen={omen} filled={filled} word={word} at={at} />}>
            {omenIcon === null ? <span className="thing-icon blank" /> : <img className="thing-icon" src={omenIcon} width={28} height={28} alt="" />}
            <span className="gear-text">
              <span className={`item-name rarity-${omen.rarity}`}>{omenName(snapshot, omen.id)}</span>
              <span className="faint small">
                {word} · {omen.rarity} · {filled} piece{filled === 1 ? "" : "s"}
                {filled >= needed ? ", active" : ", not active yet"}
              </span>
            </span>
          </Hover>
        </li>
      )}
      {gear.map((item, i) => {
        const slot = baseGearType(snapshot, item.base)?.gearSlot;
        return (
          <li key={i}>
            <Hover render={(at) => <ItemWindow item={item} level={doc.character.level} stats={derived?.stats} at={at} />}>
              <ThingIcon kind={item.unique === undefined ? "base" : "unique"} id={item.unique ?? item.base} size={28} titled={false} />
              <span className="gear-text">
                <span className={`item-name rarity-${item.rarity}`}>{itemName(snapshot, item)}</span>
                <span className="faint small">
                  {slot === undefined ? "" : `${slotName(snapshot, slot)} · `}
                  {item.runeword === undefined ? item.rarity : nameOf(game, "runeword", item.runeword)}
                </span>
              </span>
            </Hover>
          </li>
        );
      })}
    </ul>
    {jewels.length > 0 ? (
      <>
        <h3>Jewels</h3>
        <ul className="gear">
          {jewels.map((jewel, i) => {
            const icon = world.itemIcon(jewelItemId(jewel));
            const unique = jewel.unique === undefined || jewel.unique.id === WATCHER_EYE_UNIQUE ? undefined : uniqueName(snapshot, jewel.unique.id);
            return (
              <li key={i}>
                <Hover render={(at) => <JewelWindow jewel={jewel} level={doc.character.level} augments={augments} at={at} />}>
                  {icon === null ? <span className="thing-icon blank" /> : <img className="thing-icon" src={icon} width={28} height={28} alt="" />}
                  <span className="gear-text">
                    <span className={`item-name rarity-${jewel.rarity}`}>{jewelName(snapshot, jewel)}</span>
                    <span className="faint small">
                      {unique === undefined ? "" : `${unique} · `}
                      {jewel.rarity} · lvl {jewel.itemLevel}
                    </span>
                  </span>
                </Hover>
              </li>
            );
          })}
        </ul>
      </>
    ) : null}
    </>
  );
}

const TREE_LABEL: Record<TreeKey, string> = { talents: "Talents", ascendancy: "Ascendancy", atlas: "Atlas" };
const NONE = new Set<string>();
const noop = () => {};

function TreePanel({ doc }: { doc: BuildDoc }): ReactNode {
  const world = useWorld();
  const [tree, setTree] = useState<TreeKey>("talents");
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const graph = world.graph(tree);
  const allocated = useMemo(() => new Set((doc.tree?.[tree] ?? []).map(([row, col]) => nodeKey(row, col))), [doc, tree]);
  const keys = (Object.keys(TREE_KEYS) as TreeKey[]).filter((k) => (doc.tree?.[k] ?? []).length > 0);

  // The canvas zooms on the wheel, but React's wheel listener is passive and can't stop the page
  // scrolling along with it. A native, non-passive listener on the frame can.
  const frameRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = frameRef.current;
    if (frame === null) return;
    const stop = (event: WheelEvent): void => event.preventDefault();
    frame.addEventListener("wheel", stop, { passive: false });
    return () => frame.removeEventListener("wheel", stop);
  }, []);

  const level = doc.character.level;
  const perkId = hover?.perkId;
  const card = useMemo(
    () => (perkId === undefined ? undefined : perkCard(world.snapshot, perkId, { perkLevel: 1, characterLevel: level })),
    [world.snapshot, perkId, level],
  );
  // `HoverInfo` is in the canvas's own coordinates; the card wants the window's.
  const frame = hover === null ? undefined : frameRef.current?.getBoundingClientRect();

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Tree</h2>
        <nav className="tabs small">
          {keys.map((k) => (
            <button key={k} className={k === tree ? "on" : ""} onClick={() => setTree(k)}>
              {TREE_LABEL[k]} ({doc.tree?.[k]?.length ?? 0})
            </button>
          ))}
        </nav>
        <span className="faint small grow right">{hover === null ? "Hover a node to see it" : perkName(world.snapshot, hover.perkId)}</span>
      </div>
      <div className="tree" ref={frameRef}>
        {graph === undefined ? (
          <p className="faint">This pack has no {TREE_LABEL[tree].toLowerCase()} tree.</p>
        ) : (
          <TreeCanvas graph={graph} allocated={allocated} highlighted={NONE} onAllocate={noop} onDeallocate={noop} onHover={setHover} />
        )}
      </div>
      {hover === null || card === undefined || frame === undefined
        ? null
        : createPortal(<GemWindow card={card} at={{ x: frame.left + hover.x, y: frame.top + hover.y }} />, document.body)}
    </section>
  );
}
