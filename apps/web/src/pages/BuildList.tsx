import { FACET_KINDS, type FacetKind } from "@cte2/schema";
import { compact } from "@cte2/view";
import { formatFilters, parseFilters, toggleFacet, SORTS, type BuildFilters, type BuildRow, type FacetCount } from "@cob/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";

import { api } from "../api.ts";
import { ago } from "../format.ts";
import { useGame } from "../game-data.tsx";
import { KIND_LABEL, nameOf, Thing, ThingIcon } from "../names.tsx";

const SORT_LABEL: Record<BuildFilters["sort"], string> = { new: "Newest", level: "Level", dps: "DPS", ehp: "EHP" };
/** Values shown per kind before "show more". */
const SHORT_LIST = 8;

export function BuildListPage(): ReactNode {
  const [params, setParams] = useSearchParams();
  const filters = parseFilters(params);
  const query = formatFilters(filters).toString();
  const { data, error, isFetching } = useQuery({
    queryKey: ["builds", query],
    queryFn: () => api.list(query),
    placeholderData: keepPreviousData,
  });

  const update = (next: BuildFilters) => setParams(formatFilters(next));

  return (
    <div className="list-page">
      <aside className="sidebar">
        <SearchBox filters={filters} onChange={update} />
        <LevelRange filters={filters} onChange={update} />
        {FACET_KINDS.map((kind) => (
          <FacetGroup
            key={kind}
            kind={kind}
            counts={data?.facets[kind] ?? []}
            total={data?.total ?? 0}
            picked={filters.facets[kind] ?? []}
            onToggle={(value) => update(toggleFacet(filters, kind, value))}
          />
        ))}
      </aside>

      <section className="results">
        <div className="results-head">
          <span>
            {data === undefined ? "Loading…" : `${data.total} build${data.total === 1 ? "" : "s"}`}
            {isFetching && data !== undefined ? <span className="faint"> · updating</span> : null}
          </span>
          <PickedChips filters={filters} onChange={update} />
          <label className="sort">
            Sort
            <select value={filters.sort} onChange={(e) => update({ ...filters, sort: e.target.value as BuildFilters["sort"], page: 1 })}>
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? <p className="error">{error.message}</p> : null}
        {data !== undefined && data.rows.length === 0 ? <p className="empty">No builds match these filters.</p> : null}
        {data !== undefined && data.rows.length > 0 ? <BuildTable rows={data.rows} /> : null}

        {data !== undefined && data.total > data.pageSize ? (
          <div className="pager">
            <button disabled={filters.page <= 1} onClick={() => update({ ...filters, page: filters.page - 1 })}>
              ‹ Prev
            </button>
            <span>
              Page {filters.page} of {Math.ceil(data.total / data.pageSize)}
            </span>
            <button
              disabled={filters.page * data.pageSize >= data.total}
              onClick={() => update({ ...filters, page: filters.page + 1 })}
            >
              Next ›
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function BuildTable({ rows }: { rows: BuildRow[] }): ReactNode {
  return (
    <table className="builds">
      <thead>
        <tr>
          <th>Build</th>
          <th className="num">Level</th>
          <th>Skill</th>
          <th>Uniques</th>
          <th className="num">DPS</th>
          <th className="num">EHP</th>
          <th className="num">Life / MS</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>
              <Link to={`/builds/${row.id}`} className="build-cell">
                {row.ascendancy === null ? <span className="thing-icon blank" /> : <ThingIcon kind="ascendancy" id={row.ascendancy} size={28} />}
                <span>
                  <span className="title">{row.title}</span>
                  <span className="faint small">
                    {row.ascendancy === null ? "No ascendancy" : <AscName id={row.ascendancy} />} · {ago(row.createdAt)}
                  </span>
                </span>
              </Link>
            </td>
            <td className="num">{row.level}</td>
            <td>{row.mainSkill === null ? <span className="faint">–</span> : <Thing kind="skill" id={row.mainSkill} />}</td>
            <td>
              <span className="icons">
                {row.uniques.slice(0, 4).map((u) => (
                  <ThingIcon key={u} kind="unique" id={u} />
                ))}
                {row.uniques.length > 4 ? <span className="faint small">+{row.uniques.length - 4}</span> : null}
              </span>
            </td>
            <td className="num">{num(row.derived?.dps)}</td>
            <td className="num">{num(row.derived?.ehp)}</td>
            <td className="num">
              {row.derived === null ? "–" : `${num(row.derived.life)} / ${num(row.derived.es)}`}
            </td>
            <td>
              <span className={`badge ${row.kind}`}>{row.kind === "capture" ? "In-game" : "Planned"}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AscName({ id }: { id: string }): ReactNode {
  return <>{nameOf(useGame(), "ascendancy", id)}</>;
}

function FacetGroup({
  kind,
  counts,
  total,
  picked,
  onToggle,
}: {
  kind: FacetKind;
  counts: FacetCount[];
  total: number;
  picked: string[];
  onToggle: (value: string) => void;
}): ReactNode {
  const [open, setOpen] = useState(false);
  // A picked value stays listed even when nothing in the current set has it any more, so it can
  // always be unpicked from where it was picked.
  const missing = picked.filter((v) => !counts.some((c) => c.value === v)).map((value) => ({ value, count: 0 }));
  const all = [...missing, ...counts];
  if (all.length === 0) return null;
  const shown = open ? all : all.slice(0, SHORT_LIST);
  // A picked kind's counts are over the list without that kind's own filter, a set whose size
  // the API doesn't return, so its bars scale to the largest count and show no percentage.
  const scale = picked.length > 0 ? Math.max(1, ...counts.map((c) => c.count)) : total;
  return (
    <div className="facet">
      <h3>{KIND_LABEL[kind]}</h3>
      <ul>
        {shown.map(({ value, count }) => {
          const on = picked.includes(value);
          const pct = scale > 0 ? (count / scale) * 100 : 0;
          return (
            <li key={value}>
              <button className={on ? "on" : ""} onClick={() => onToggle(value)} title={value}>
                <span className="bar" style={{ width: `${Math.min(100, pct)}%` }} />
                <Thing kind={kind} id={value} size={16} />
                <span className="count">
                  {count}
                  {picked.length > 0 ? null : <span className="faint"> · {Math.round(pct)}%</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {all.length > SHORT_LIST ? (
        <button className="more" onClick={() => setOpen(!open)}>
          {open ? "Show fewer" : `Show ${all.length - SHORT_LIST} more`}
        </button>
      ) : null}
    </div>
  );
}

function PickedChips({ filters, onChange }: { filters: BuildFilters; onChange: (f: BuildFilters) => void }): ReactNode {
  const game = useGame();
  const chips = FACET_KINDS.flatMap((kind) => (filters.facets[kind] ?? []).map((value) => ({ kind, value })));
  if (chips.length === 0) return <span className="grow" />;
  return (
    <span className="chips grow">
      {chips.map(({ kind, value }) => (
        <button key={`${kind}:${value}`} className="chip" onClick={() => onChange(toggleFacet(filters, kind, value))}>
          {nameOf(game, kind, value)} ✕
        </button>
      ))}
      <button className="chip clear" onClick={() => onChange({ ...filters, facets: {}, page: 1 })}>
        Clear all
      </button>
    </span>
  );
}

function SearchBox({ filters, onChange }: { filters: BuildFilters; onChange: (f: BuildFilters) => void }): ReactNode {
  const [text, setText] = useState(filters.q ?? "");
  return (
    <form
      className="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = text.trim();
        const next: BuildFilters = { ...filters, page: 1 };
        if (q) next.q = q;
        else delete next.q;
        onChange(next);
      }}
    >
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search build titles" />
    </form>
  );
}

function LevelRange({ filters, onChange }: { filters: BuildFilters; onChange: (f: BuildFilters) => void }): ReactNode {
  const set = (key: "levelMin" | "levelMax", raw: string) => {
    const next: BuildFilters = { ...filters, page: 1 };
    const n = Number(raw);
    if (raw === "" || !Number.isInteger(n) || n < 0) delete next[key];
    else next[key] = n;
    onChange(next);
  };
  return (
    <div className="facet level">
      <h3>Level</h3>
      <div className="row">
        <input type="number" min={1} placeholder="min" defaultValue={filters.levelMin ?? ""} onBlur={(e) => set("levelMin", e.target.value)} />
        <span className="faint">to</span>
        <input type="number" min={1} placeholder="max" defaultValue={filters.levelMax ?? ""} onBlur={(e) => set("levelMax", e.target.value)} />
      </div>
    </div>
  );
}

/** Unindexed numbers are dashes, not zeroes. */
function num(n: number | null | undefined): string {
  return n === null || n === undefined ? "–" : compact(n);
}
