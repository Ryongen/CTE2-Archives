import assert from "node:assert/strict";
import { test } from "node:test";

import type { BuildDoc } from "@cte2/schema";

import { canBeMainSkill, markedMainSkill, withMainSkill } from "./main-skill.ts";

const doc = (extra: Partial<BuildDoc> = {}): BuildDoc =>
  ({
    character: { level: 50 },
    skills: [{ spellId: "protection" }, { spellId: "quake" }, { spellId: "fireball", enabled: false }],
    ...extra,
  }) as BuildDoc;

test("an export marks no main skill", () => {
  assert.equal(markedMainSkill(doc()), undefined);
});

test("marking a skill clears the others and the swing setting", () => {
  const before = doc({ config: { mainIsBasicAttack: true } } as Partial<BuildDoc>);
  before.skills![0]!.main = true;
  const after = withMainSkill(before, 1);
  assert.equal(markedMainSkill(after), 1);
  assert.equal(after.skills![0]!.main, undefined);
  assert.equal(after.config?.mainIsBasicAttack, undefined);
});

test("only an enabled skill can be the main one", () => {
  assert.equal(canBeMainSkill(doc(), 1), true);
  assert.equal(canBeMainSkill(doc(), 2), false);
  assert.equal(canBeMainSkill(doc(), 3), false);
  assert.equal(canBeMainSkill(doc(), "1"), false);
});
