/**
 * Facet values are ids; this is how the site says and draws them. Every lookup falls back to a
 * humanised id, so a value from a newer pack than the loaded snapshot still reads as words.
 */

import {
  auraName,
  baseGearType,
  gearTypeName,
  humanise,
  omenName,
  perk,
  perkName,
  runewordName,
  spellName,
  supportGemName,
  unique,
  uniqueName,
  type FacetKind,
} from "@cte2/schema";
import type { ReactNode } from "react";

import { useGame, type GameData } from "./game-data.tsx";

export const KIND_LABEL: Record<FacetKind, string> = {
  ascendancy: "Ascendancy",
  skill: "Skill",
  support: "Support",
  augment: "Augment",
  unique: "Unique",
  keystone: "Keystone",
  runeword: "Runeword",
  omen: "Omen",
  school: "Spell school",
  start: "Class start",
  base: "Base type",
};

export function nameOf(game: GameData | null, kind: FacetKind, id: string): string {
  if (game === null) return humanise(id);
  const s = game.snapshot;
  const named = (() => {
    switch (kind) {
      case "ascendancy":
      case "keystone":
      case "start":
        return perkName(s, id);
      case "skill":
        return spellName(s, id);
      case "support":
        return supportGemName(s, id);
      case "augment":
        return auraName(s, id);
      case "unique":
        return uniqueName(s, id);
      case "runeword":
        return runewordName(s, id);
      case "omen":
        return omenName(s, id);
      case "base":
        return gearTypeName(s, id);
      case "school":
        return humanise(id);
    }
  })();
  return named || humanise(id);
}

export function iconOf(game: GameData | null, kind: FacetKind, id: string): string | null {
  if (game === null) return null;
  const { assetUrl, itemIconUrl } = game.assets;
  switch (kind) {
    case "skill":
      return assetUrl(`mmorpg:textures/gui/spells/icons/${id}.png`);
    case "school":
      return assetUrl(`mmorpg:textures/gui/asc_classes/class/${id}.png`);
    case "ascendancy":
    case "keystone":
    case "start": {
      const icon = perk(game.snapshot, id)?.icon;
      return icon === undefined || icon === "" ? null : assetUrl(icon);
    }
    case "unique": {
      const base = unique(game.snapshot, id)?.baseGear;
      return base === undefined ? null : gearIcon(game, base);
    }
    case "base":
      return gearIcon(game, id);
    default:
      return null;
  }
}

/** A base's first Minecraft item that has a sprite, as `SnapshotWorld.gearIcon` picks it. */
function gearIcon(game: GameData, baseId: string): string | null {
  for (const itemId of baseGearType(game.snapshot, baseId)?.itemIds ?? []) {
    const url = game.assets.itemIconUrl(itemId);
    if (url !== null) return url;
  }
  return null;
}

/**
 * An id as an icon and a name. `titled={false}` drops the browser tooltip, for a thing that has a
 * hover card of its own.
 */
export function Thing({ kind, id, size = 18, titled = true }: { kind: FacetKind; id: string; size?: number; titled?: boolean }): ReactNode {
  const game = useGame();
  const icon = iconOf(game, kind, id);
  return (
    <span className="thing" title={titled ? `${KIND_LABEL[kind]}: ${id}` : undefined}>
      {icon === null ? null : <img src={icon} width={size} height={size} alt="" draggable={false} />}
      {nameOf(game, kind, id)}
    </span>
  );
}

/** Just the icon, with the name as a tooltip. Falls back to the name when there is no icon. */
export function ThingIcon({ kind, id, size = 22, titled = true }: { kind: FacetKind; id: string; size?: number; titled?: boolean }): ReactNode {
  const game = useGame();
  const icon = iconOf(game, kind, id);
  const name = nameOf(game, kind, id);
  if (icon === null) return <span className="thing-chip">{name}</span>;
  return (
    <img className="thing-icon" src={icon} width={size} height={size} alt={name} title={titled ? name : undefined} draggable={false} />
  );
}
