import assert from "node:assert/strict";
import { test } from "node:test";

import type { Observation } from "@cte2/schema";

import { checkCapture } from "./capture.ts";

const observed: Observation = {
  source: "mod_dump",
  capturedAt: "2026-10-01",
  mineAndSlashVersion: "6.4.13",
  packVersion: "1",
  stats: [
    { statId: "health", currentValue: 4601 },
    { statId: "critical_damage", currentValue: 300 },
  ],
};

test("a stat the build doesn't explain is reported", () => {
  const stats = new Map([
    ["health", { value: 4601 }],
    ["critical_damage", { value: 150 }],
  ]);
  const check = checkCapture(observed, stats, "1.20.1-6.4.13");
  assert.equal(check.checked, 2);
  assert.deepEqual(check.wrong.map((r) => r.statId), ["critical_damage"]);
  assert.equal(check.stale, false);
});

test("a capture from another version is marked stale", () => {
  const stats = new Map([
    ["health", { value: 4601 }],
    ["critical_damage", { value: 300 }],
  ]);
  const check = checkCapture(observed, stats, "1.20.1-6.5.0");
  assert.equal(check.wrong.length, 0);
  assert.equal(check.stale, true);
});
