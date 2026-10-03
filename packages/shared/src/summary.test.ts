import assert from "node:assert/strict";
import { test } from "node:test";

import { normaliseVersion } from "./summary.ts";

test("versions are stored without the Minecraft prefix, and unknown is no version", () => {
  assert.equal(normaliseVersion("1.20.1-6.4.13"), "6.4.13");
  assert.equal(normaliseVersion("6.4.13"), "6.4.13");
  assert.equal(normaliseVersion("unknown"), null);
  assert.equal(normaliseVersion(undefined), null);
});
