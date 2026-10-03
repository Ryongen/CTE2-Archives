import assert from "node:assert/strict";
import { test } from "node:test";

import { legalityOf } from "./legality.ts";

test("a runeword on the wrong slot is legal but can't be made today", () => {
  const out = legalityOf([
    { severity: "warning", code: "runeword-wrong-slot", path: "gear[0].runeword", message: "" },
    { severity: "warning", code: "no-main-stage", path: "stages", message: "" },
    { severity: "info", code: "whatever", path: "", message: "" },
  ]);
  assert.equal(out.errors.length, 0);
  assert.equal(out.notMakeable.length, 1);
  assert.equal(out.warnings.length, 1);
});

test("errors are kept apart from warnings", () => {
  const out = legalityOf([{ severity: "error", code: "too-many-runes", path: "gear[0].runes", message: "" }]);
  assert.equal(out.errors.length, 1);
});
