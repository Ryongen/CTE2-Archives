/**
 * A capture against CoB's numbers. A capture carries the game's own finished stat sheet
 * (`observed`); CoB recomputes the same sheet from the gear, tree and skills alone. Where they
 * agree, everything on the character comes from what the build shows. Where they don't, either
 * CoB is missing a mechanic or something outside the build moved the number — a command, say.
 *
 * Same rule as CoB's Capture panel (`compareObserved`): the bound comes from how the capture was
 * taken, and a stat CoB doesn't have reads 0, as the game reads one it doesn't hold.
 */

import { samePackVersion, toleranceFor, type Observation } from "@cte2/schema";

export type CaptureRow = { statId: string; expected: number; actual: number; delta: number };

export type CaptureCheck = {
  checked: number;
  /** The stats that disagree, furthest off first (relative to the game's value). */
  wrong: CaptureRow[];
  /** Captured on another Mine and Slash version than the snapshot, so drift is possible. */
  stale: boolean;
  capturedOn: string;
};

export function checkCapture(
  observed: Observation,
  stats: ReadonlyMap<string, { value: number }>,
  snapshotVersion: string,
): CaptureCheck {
  const limit = toleranceFor("currentValue", observed.source);
  const wrong: CaptureRow[] = [];
  for (const o of observed.stats) {
    const actual = stats.get(o.statId)?.value ?? 0;
    const delta = actual - o.currentValue;
    if (Math.abs(delta) > limit.absolute + Math.abs(o.currentValue) * limit.relative) {
      wrong.push({ statId: o.statId, expected: o.currentValue, actual, delta });
    }
  }
  const off = (r: CaptureRow) => Math.abs(r.delta) / Math.max(1, Math.abs(r.expected));
  wrong.sort((a, b) => off(b) - off(a));
  return {
    checked: observed.stats.length,
    wrong,
    stale: !samePackVersion(observed.mineAndSlashVersion, snapshotVersion),
    capturedOn: observed.mineAndSlashVersion,
  };
}
