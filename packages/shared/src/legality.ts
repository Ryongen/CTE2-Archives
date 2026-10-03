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
