/**
 * How the catalogue reads CoB's diagnostics. "Legal" is CoB's own verdict: no `error`, so the game
 * would let this character exist. A handful of warnings say something narrower that matters to
 * anyone copying a build: the item is fine where it is, but this version of the pack won't make
 * it again (a runeword whose slot list changed, more sockets than can be added today, an omen
 * modified after it dropped). Those get their own label rather than being folded into either.
 */

import type { Diagnostic } from "@cte2/schema";

/** Warning codes for things a character can carry but can't be crafted on the current pack. */
export const NOT_MAKEABLE_CODES: ReadonlySet<string> = new Set([
  "runeword-wrong-slot",
  "runeword-runes-mismatch",
  "too-many-sockets",
  "quality-above-pack-ceiling",
  "affix-not-allowed-on-jewel",
  "too-many-eye-lines",
  "omen-below-drop-level",
  "omen-requirement-outside-band",
  "omen-slot-count-outside-band",
  "omen-affix-count-outside-band",
]);

/**
 * The diagnostics sorted for display. Whether the build is legal is `DerivedBuild.legal`, which
 * looks at the validator alone; `errors` here also holds the engine's own, like a damage pipeline
 * that threw.
 */
export type Legality = {
  errors: Diagnostic[];
  /** Warnings in `NOT_MAKEABLE_CODES`. */
  notMakeable: Diagnostic[];
  /** Every other warning. */
  warnings: Diagnostic[];
};

/**
 * One line a player can read for each `NOT_MAKEABLE_CODES` warning. CoB's own messages are written
 * for whoever maintains the validator (ids, class names, why it only warns), which is too much on
 * a build page; the full message stays available as a tooltip.
 */
const NOT_MAKEABLE_WORDING: Readonly<Record<string, string>> = {
  "runeword-wrong-slot": "Its runeword can't be put on this kind of item any more.",
  "runeword-runes-mismatch": "Its runes no longer match its runeword's recipe.",
  "too-many-sockets": "Has more sockets than can be added today.",
  "quality-above-pack-ceiling": "Has more quality than the pack's currencies can reach.",
  "affix-not-allowed-on-jewel": "Has an affix that no longer rolls on this jewel.",
  "too-many-eye-lines": "Has more augment lines than the pack grants.",
  "omen-below-drop-level": "This omen doesn't drop at that level any more.",
  "omen-requirement-outside-band": "This omen's requirements are outside what drops today.",
  "omen-slot-count-outside-band": "This omen's slot requirements are outside what drops today.",
  "omen-affix-count-outside-band": "This omen has more or fewer affixes than drop today.",
};

/** The short wording for a diagnostic, or its own message when there isn't one. */
export function plainMessage(d: Diagnostic): string {
  return NOT_MAKEABLE_WORDING[d.code] ?? d.message;
}

export function legalityOf(diagnostics: readonly Diagnostic[]): Legality {
  const errors: Diagnostic[] = [];
  const notMakeable: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];
  for (const d of diagnostics) {
    if (d.severity === "error") errors.push(d);
    else if (d.severity === "warning") (NOT_MAKEABLE_CODES.has(d.code) ? notMakeable : warnings).push(d);
  }
  return { errors, notMakeable, warnings };
}
