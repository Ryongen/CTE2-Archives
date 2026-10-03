/**
 * The hover cards: an item, a skill, a support gem or Augment, and a tree node, drawn the way CoB
 * draws them.
 *
 * Ported from CoB's `ui/ItemTooltip.tsx` and `ui/SpellTooltip.tsx`. Those read the planner's own
 * stores for the character level and the sheet; here both are handed in, because the catalogue
 * has no store, only the document on the page and the `deriveBuild` run over it. The content comes
 * from `@cte2/view` (`itemSections`, `spellCard`, `supportGemCard`, `auraCard`, `perkCard`), so a
 * card here says what the same card in CoB says. The CSS is copied from CoB's `styles.css`.
 */

import { balance, checkRequirements, parseRolledMods, rollToExact, statIndex, type DerivedBuild } from "@cte2/engine";
import {
  affix,
  gearTypeName,
  humanise,
  itemName,
  jewelItemId,
  jewelName,
  omenBuckets,
  omenName,
  slotName,
  statName,
  uniqueName,
  WATCHER_EYE_UNIQUE,
  type Item,
  type Jewel,
  type OmenSetup,
} from "@cte2/schema";
import {
  floatingStyle,
  itemSections,
  jewelSections,
  smart,
  useWorld,
  type At,
  type CardFact,
  type GemCard,
  type ItemSection,
  type SpellCard,
  type StatLine,
} from "@cte2/view";
import { useMemo, type ReactNode } from "react";

import { useGame } from "../game-data.tsx";
import { iconOf } from "../names.tsx";

/** Assumed sizes for the edge flip; see `floatingStyle`. */
const ITEM_CARD = { width: 320, height: 350 };
const SPELL_CARD = { width: 340, height: 420 };
const GEM_CARD = { width: 320, height: 200 };

const SPELL_ICON = (id: string): string => `mmorpg:textures/gui/spells/icons/${id}.png`;
const GEM_ICON = "mmorpg:textures/gui/prophecy/support_gem.png";
const AUGMENT_ICON = "mmorpg:textures/gui/prophecy/aura_gem.png";

const GEM_LOOK: Record<string, { css: string; icon: string }> = {
  Augment: { css: "tt-gem", icon: AUGMENT_ICON },
  Passive: { css: "tt-perk-card", icon: GEM_ICON },
};

/** Splits `"+40 Armor"` into the value the game colours and the words it leaves white. */
function formattedLine(line: string): ReactNode {
  return line.split(/([+-]?\d+(?:\.\d+)?%?\w?)/g).map((part, i) => (
    <span key={i} className={/[+-]?\d+(?:\.\d+)?%?\w?/.test(part) ? "stat-val" : "stat-text"}>
      {part}
    </span>
  ));
}

function StatBlock({ lines }: { lines: readonly StatLine[] }): ReactNode {
  return lines.map((line, i) => (
    <div key={`${line.statId}-${i}`} className={`tt-line${line.good ? "" : " worse"}`}>
      {formattedLine(line.text)}
    </div>
  ));
}

function FactRow({ fact, accent = false }: { fact: CardFact; accent?: boolean }): ReactNode {
  return (
    <div className="tt-fact" title={fact.title}>
      <span className="tt-fact-k">{fact.label}</span>
      <span className={`tt-fact-v${accent ? " accent" : ""}`}>{fact.value}</span>
    </div>
  );
}

export function ItemWindow({
  item,
  level,
  stats,
  at,
}: {
  item: Item;
  /** The character's level: what every roll resolves at, and the level gate. */
  level: number;
  /** The character sheet, for the attribute requirements. */
  stats: DerivedBuild["stats"] | undefined;
  at: At;
}): ReactNode {
  const { snapshot } = useWorld();
  const game = useGame();
  const checks = useMemo(
    () => (stats === undefined ? [] : checkRequirements(snapshot, item, stats)),
    [snapshot, item, stats],
  );
  const sections = useMemo(() => itemSections(snapshot, item, level), [snapshot, item, level]);

  const name = itemName(snapshot, item);
  const base = gearTypeName(snapshot, item.base);
  const icon = iconOf(game, "base", item.base);
  const levelMet = item.itemLevel <= level;

  return (
    <div className={`item-window rarity-${(item.rarity ?? "common").toLowerCase()} floating`} style={floatingStyle(at, ITEM_CARD)}>
      <div className="tt-header">
        <div className="tt-icon-frame">{icon === null ? null : <img className="tt-spell-icon" src={icon} alt="" />}</div>
        <div className="tt-title-container">
          <div className="tt-title">{name}</div>
          {name === base ? null : <div className="tt-subtitle">{base}</div>}
        </div>
      </div>

      <div className="tt-divider" />

      {checks.length > 0 || item.itemLevel > 0 ? (
        <>
          <div className="tt-section tt-requirements">
            {item.itemLevel > 0 ? (
              <div className={`tt-req ${levelMet ? "met" : "unmet"}`}>
                <span className="tt-icon">{levelMet ? "✔" : "✘"}</span>
                <span>Player Level Min: {item.itemLevel}</span>
              </div>
            ) : null}
            {checks.map((check) => (
              <div key={check.statId} className={`tt-req ${check.met ? "met" : "unmet"}`}>
                <span className="tt-icon">{check.met ? "✔" : "✘"}</span>
                <span>
                  {statName(snapshot, check.statId)} Min: {check.required}
                </span>
              </div>
            ))}
          </div>
          <div className="tt-divider" />
        </>
      ) : null}

      <div className="tt-section tt-stats">
        {sections.map((section) => (
          <CategoryGroup key={section.id} section={section} />
        ))}
      </div>

      <div className="tt-divider" />

      {item.sockets !== undefined && item.sockets.length > 0 ? (
        <>
          <div className="tt-section tt-sockets">
            {item.sockets.map((_, i) => (
              <div key={i} className="tt-socket-line">
                [Socket]
              </div>
            ))}
          </div>
          <div className="tt-divider" />
        </>
      ) : null}

      <div className="tt-footer">
        <div className="tt-rarity-label">{item.rarity ? `${item.rarity} Item` : "Item"}</div>
      </div>
    </div>
  );
}

function CategoryGroup({ section }: { section: ItemSection }): ReactNode {
  if (section.lines.length === 0) return null;
  return (
    <div className={`tt-category-group${section.dormant === true ? " dormant" : ""}`}>
      <div className={`tt-category-title ${section.kind}`}>
        {section.label}:{section.dormant === true ? <div className="tt-dormant">not socketed, grants nothing</div> : null}
      </div>
      <StatBlock lines={section.lines} />
    </div>
  );
}

export function SpellWindow({ card, at }: { card: SpellCard; at: At }): ReactNode {
  const world = useWorld();
  const icon = world.icon(SPELL_ICON(card.id));

  return (
    <div className="item-window tt-spell floating" style={floatingStyle(at, SPELL_CARD)}>
      <div className="tt-header">
        <div className="tt-icon-frame">{icon === null ? null : <img className="tt-spell-icon" src={icon} alt="" />}</div>
        <div className="tt-title-container">
          <div className="tt-title">{card.name}</div>
          <div className="tt-subtitle">{card.kind}</div>
        </div>
      </div>

      {card.description.length > 0 ? (
        <>
          <div className="tt-divider" />
          <div className="tt-section tt-desc">
            {card.description.map((spans, i) => (
              <p key={i} className="tt-line">
                {spans.map((span, j) => (
                  <span
                    key={j}
                    style={{
                      color: span.colour,
                      fontWeight: span.bold ? 700 : undefined,
                      fontStyle: span.italic ? "italic" : undefined,
                    }}
                  >
                    {span.text}
                  </span>
                ))}
              </p>
            ))}
          </div>
        </>
      ) : null}

      <div className="tt-divider" />

      <div className="tt-section tt-facts">
        <FactRow fact={{ label: "Skill Level", value: String(card.level.shown) }} accent />
        <FactRow
          fact={{
            label: "Max Gem Level",
            value:
              card.level.ceiling > card.level.natural
                ? `${card.level.natural} (${card.level.ceiling} with gear)`
                : String(card.level.natural),
          }}
        />
        {card.costs.map((cost) => (
          <div key={cost.label} className="tt-fact">
            <span className="tt-fact-k">{cost.label}</span>
            <span className="tt-fact-v" style={{ color: cost.colour }}>
              {smart(cost.value)}
            </span>
          </div>
        ))}
        {card.facts.map((fact) => (
          <FactRow key={fact.label} fact={fact} />
        ))}
      </div>

      {card.tags.length > 0 ? (
        <>
          <div className="tt-divider" />
          <div className="tt-chips">
            {card.tags.map((tag) => (
              <span key={tag} className="tt-chip">
                {tag.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </>
      ) : null}

      {card.stats.length > 0 ? (
        <>
          <div className="tt-divider" />
          <div className="tt-section tt-stats">
            <div className="tt-category-title">Gem Stats at Level {card.level.shown}</div>
            <StatBlock lines={card.stats} />
          </div>
        </>
      ) : null}
    </div>
  );
}

/** A support gem, an Augment or a tree node: the same small card. */
export function GemWindow({ card, at }: { card: GemCard; at: At }): ReactNode {
  const world = useWorld();
  const look = GEM_LOOK[card.kind] ?? { css: "tt-gem", icon: GEM_ICON };
  const icon = world.icon(card.icon) ?? world.icon(look.icon);

  return (
    <div className={`item-window ${look.css} floating`} style={floatingStyle(at, GEM_CARD)}>
      <div className="tt-header">
        <div className="tt-icon-frame">{icon === null ? null : <img className="tt-spell-icon" src={icon} alt="" />}</div>
        <div className="tt-title-container">
          <div className="tt-title">{card.name}</div>
          <div className="tt-subtitle">{card.kind}</div>
        </div>
      </div>

      <div className="tt-divider" />

      {card.stats.length > 0 ? (
        <div className="tt-section tt-stats">
          <StatBlock lines={card.stats} />
        </div>
      ) : (
        <div className="tt-line faint">Grants no stats of its own.</div>
      )}

      {card.facts.length > 0 ? (
        <>
          <div className="tt-divider" />
          <div className="tt-section tt-facts">
            {card.facts.map((fact) => (
              <FactRow key={fact.label} fact={fact} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** A jewel: no base, no implicit, one affix list. Its item level is what the rolls resolve at. */
export function JewelWindow({ jewel, level, augments, at }: { jewel: Jewel; level: number; augments: ReadonlySet<string>; at: At }): ReactNode {
  const world = useWorld();
  const { snapshot } = world;
  const sections = useMemo(() => jewelSections(snapshot, jewel, level, augments), [snapshot, jewel, level, augments]);
  // A Watcher's Eye's `unique` is a marker, not a unique the registry can name.
  const unique = jewel.unique === undefined || jewel.unique.id === WATCHER_EYE_UNIQUE ? null : uniqueName(snapshot, jewel.unique.id);
  const icon = world.itemIcon(jewelItemId(jewel));

  return (
    <div className={`item-window rarity-${(jewel.rarity ?? "common").toLowerCase()} floating`} style={floatingStyle(at, ITEM_CARD)}>
      <div className="tt-header">
        <div className="tt-icon-frame">{icon === null ? null : <img className="tt-spell-icon" src={icon} alt="" />}</div>
        <div className="tt-title-container">
          <div className="tt-title">{jewelName(snapshot, jewel)}</div>
          {unique === null ? null : <div className="tt-subtitle">{unique}</div>}
        </div>
      </div>
      <div className="tt-divider" />
      <div className="tt-section tt-stats">
        {sections.length === 0 ? (
          <div className="tt-line">
            <span className="stat-text">No stats</span>
          </div>
        ) : (
          sections.map((section) => <CategoryGroup key={section.id} section={section} />)
        )}
      </div>
      <div className="tt-divider" />
      <div className="tt-footer">
        <div className="tt-rarity-label">{jewel.rarity ? `${jewel.rarity} Jewel` : "Jewel"}</div>
        <div className="tt-subtitle">Item Level {jewel.itemLevel}</div>
      </div>
    </div>
  );
}

const OMEN_ICON = "mmorpg:textures/gui/prophecy/omen.png";

/**
 * The codex (the data calls it an omen): a set bonus paid out in steps by how many worn pieces
 * qualify. Each step's lines are resolved as CoB's `OmenEditor` does, and the ones the build
 * hasn't reached are dimmed.
 */
export function OmenWindow({ omen, filled, word, at }: { omen: OmenSetup; filled: number; word: string; at: At }): ReactNode {
  const world = useWorld();
  const { snapshot } = world;
  const buckets = useMemo(() => {
    const index = statIndex(snapshot);
    const bal = balance(snapshot);
    return omenBuckets(snapshot, omen)
      .map((bucket) => {
        const source = bucket.mods ?? affix(snapshot, bucket.affix?.affixId ?? "")?.stats ?? [];
        const lines = parseRolledMods(source as Record<string, unknown>[]).map((mod) => {
          const exact = rollToExact(mod, bucket.statPercent, omen.itemLevel, index.shapeOf(mod.statId), bal);
          const name = statName(snapshot, mod.statId);
          const suffix = mod.type === "PERCENT" ? `% Increased ${name}` : mod.type === "MORE" ? `% More ${name}` : ` ${name}`;
          return { text: `${exact.value >= 0 ? "+" : ""}${smart(exact.value)}${suffix}`, good: exact.value >= 0 };
        });
        return { pieces: bucket.pieces, lines };
      })
      .sort((a, b) => a.pieces - b.pieces);
  }, [snapshot, omen]);
  const icon = world.icon(OMEN_ICON);
  const requires = Object.entries(omen.requires ?? {}).filter(([, n]) => n > 0);

  return (
    <div className={`item-window rarity-${omen.rarity.toLowerCase()} floating`} style={floatingStyle(at, ITEM_CARD)}>
      <div className="tt-header">
        <div className="tt-icon-frame">{icon === null ? null : <img className="tt-spell-icon" src={icon} alt="" />}</div>
        <div className="tt-title-container">
          <div className="tt-title">{omenName(snapshot, omen.id)}</div>
          <div className="tt-subtitle">
            {word} · {filled} piece{filled === 1 ? "" : "s"} worn
          </div>
        </div>
      </div>
      <div className="tt-divider" />
      {requires.length > 0 || (omen.slotRequirements ?? []).length > 0 ? (
        <>
          <div className="tt-section tt-facts">
            {requires.map(([type, count]) => (
              <FactRow key={type} fact={{ label: `${humanise(type.toLowerCase())} pieces`, value: String(count) }} />
            ))}
            {(omen.slotRequirements ?? []).map((req, i) => (
              <FactRow key={i} fact={{ label: slotName(snapshot, req.slot), value: humanise(req.rarityType.toLowerCase()) }} />
            ))}
          </div>
          <div className="tt-divider" />
        </>
      ) : null}
      <div className="tt-section tt-stats">
        {buckets.map((bucket, i) => (
          <div key={i} className={`tt-category-group${filled >= bucket.pieces ? "" : " dormant"}`}>
            <div className="tt-category-title unique">
              {bucket.pieces} pieces:
              {filled >= bucket.pieces ? null : <div className="tt-dormant">not reached</div>}
            </div>
            {bucket.lines.length === 0 ? (
              <div className="tt-line">
                <span className="stat-text">No stats</span>
              </div>
            ) : (
              bucket.lines.map((line, j) => (
                <div key={j} className={`tt-line${line.good ? "" : " worse"}`}>
                  {formattedLine(line.text)}
                </div>
              ))
            )}
          </div>
        ))}
      </div>
      <div className="tt-divider" />
      <div className="tt-footer">
        <div className="tt-rarity-label">
          {omen.rarity} {word}
        </div>
        <div className="tt-subtitle">Item Level {omen.itemLevel}</div>
      </div>
    </div>
  );
}
