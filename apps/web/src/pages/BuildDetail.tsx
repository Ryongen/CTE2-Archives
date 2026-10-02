/**
 * One build. The numbers are computed here, in the browser, with the same `deriveBuild` CoB runs,
 * so what this page says and what CoB says about the same document cannot disagree.
 */

import { damageRates, deriveBuild, type DerivedBuild } from "@cte2/engine";
import {
  activeSupportLinks,
  baseGearType,
  isAuraEnabled,
  isSkillEnabled,
  itemName,
  nodeKey,
  perkName,
  slotName,
  stageDoc,
  stageList,
  TREE_KEYS,
  type BuildDoc,
  type BuildStage,
  type TreeKey,
} from "@cte2/schema";
import { compact, TreeCanvas, useWorld, type HoverInfo } from "@cte2/view";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router";

import { api } from "../api.ts";
import { OpenInCob } from "../components/OpenInCob.tsx";
import { ago } from "../format.ts";
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
            {build.mnsVersion === null ? "" : ` · M&S ${build.mnsVersion}`} · uploaded {ago(build.createdAt)}
            {build.kind === "capture" ? <span className="badge capture">In-game capture</span> : <span className="badge planned">Planned</span>}
          </p>
        </div>
        <OpenInCob id={build.id} doc={doc.data} title={build.title} />
      </header>

      {stages.length > 1 ? <StagePicker stages={stages} current={stage?.id} mainId={mainId} onPick={setPicked} /> : null}

      <WhenLoaded fallback={<p className="empty">Loading game data…</p>}>
        <Numbers doc={shown} />
      </WhenLoaded>

      <div className="columns">
        <section className="panel">
          <h2>Skills</h2>
          <Skills doc={shown} />
        </section>
        <section className="panel">
          <h2>Equipment</h2>
          <Gear doc={shown} />
        </section>
      </div>

      <WhenLoaded>
        <TreePanel doc={shown} />
      </WhenLoaded>

      {build.notes ? (
        <section className="panel">
          <h2>Notes</h2>
          <p className="notes">{build.notes}</p>
        </section>
      ) : null}
    </div>
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

function Numbers({ doc }: { doc: BuildDoc }): ReactNode {
  const { snapshot } = useWorld();
  const derived = useMemo((): DerivedBuild | Error => {
    try {
      return deriveBuild(doc, snapshot);
    } catch (error) {
      return error instanceof Error ? error : new Error(String(error));
    }
  }, [doc, snapshot]);
  if (derived instanceof Error) return <p className="error">CoB couldn't compute this build: {derived.message}</p>;

  const rates = damageRates({
    dps: derived.dps,
    fullDps: derived.fullDps,
    basicDps: derived.basic?.dps ?? 0,
    basicProcDps: derived.basic?.procDps ?? 0,
  });
  const { pools, weakest } = derived.defence;
  const problems = derived.diagnostics.filter((d) => d.severity === "error").length;

  return (
    <div className="figures">
      <Figure label="Total DPS" value={compact(rates.total)} />
      <Figure label="EHP" value={compact(weakest.effectiveHealth)} hint={`against ${weakest.element}, your weakest element`} />
      <Figure label="Life" value={compact(pools.health)} />
      <Figure label="Magic shield" value={compact(pools.magicShield)} />
      <Figure
        label="Legality"
        value={derived.legal ? "Legal" : `${problems} problem${problems === 1 ? "" : "s"}`}
        tone={derived.legal ? "good" : "bad"}
      />
    </div>
  );
}

function Figure({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }): ReactNode {
  return (
    <div className="figure" title={hint}>
      <span className="label">{label}</span>
      <span className={`value ${tone ?? ""}`}>{value}</span>
    </div>
  );
}

function Skills({ doc }: { doc: BuildDoc }): ReactNode {
  const skills = (doc.skills ?? []).filter(isSkillEnabled);
  const augments = (doc.auras ?? []).filter(isAuraEnabled);
  if (skills.length === 0 && augments.length === 0) return <p className="faint">No skills.</p>;
  return (
    <>
      <ul className="skills">
        {skills.map((skill, i) => (
          <li key={`${skill.spellId}-${i}`}>
            <Thing kind="skill" id={skill.spellId} size={24} />
            {skill.main === true ? <span className="badge">Main</span> : null}
            <span className="supports">
              {activeSupportLinks(skill).map((link) => (
                <Thing key={link.id} kind="support" id={link.id} size={16} />
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
              <Thing key={a.id} kind="augment" id={a.id} size={16} />
            ))}
          </p>
        </>
      ) : null}
    </>
  );
}

function Gear({ doc }: { doc: BuildDoc }): ReactNode {
  const game = useGame();
  const gear = doc.gear ?? [];
  if (gear.length === 0) return <p className="faint">No gear.</p>;
  return (
    <ul className="gear">
      {gear.map((item, i) => {
        const slot = game === null ? undefined : baseGearType(game.snapshot, item.base)?.gearSlot;
        return (
          <li key={i}>
            <ThingIcon kind={item.unique === undefined ? "base" : "unique"} id={item.unique ?? item.base} size={28} />
            <span>
              <span className={`item-name rarity-${item.rarity}`}>
                {game === null ? (item.unique ?? item.base) : itemName(game.snapshot, item)}
              </span>
              <span className="faint small">
                {slot === undefined || game === null ? "" : `${slotName(game.snapshot, slot)} · `}
                {item.runeword === undefined ? item.rarity : nameOf(game, "runeword", item.runeword)}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
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
      <div className="tree">
        {graph === undefined ? (
          <p className="faint">This pack has no {TREE_LABEL[tree].toLowerCase()} tree.</p>
        ) : (
          <TreeCanvas graph={graph} allocated={allocated} highlighted={NONE} onAllocate={noop} onDeallocate={noop} onHover={setHover} />
        )}
      </div>
    </section>
  );
}
