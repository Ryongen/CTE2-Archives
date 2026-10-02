import assert from "node:assert/strict";
import { test } from "node:test";

import { formatFilters, parseFilters, toggleFacet } from "./filters.ts";

test("filters round-trip through a query string", () => {
  const params = new URLSearchParams("skill=fireball,frost_nova&ascendancy=sanguimancer&levelMin=40&sort=dps&page=2");
  const filters = parseFilters(params);
  assert.deepEqual(filters.facets, { skill: ["fireball", "frost_nova"], ascendancy: ["sanguimancer"] });
  assert.equal(filters.levelMin, 40);
  assert.equal(filters.sort, "dps");
  assert.equal(filters.page, 2);
  assert.deepEqual(parseFilters(formatFilters(filters)), filters);
});

test("unknown kinds, bad numbers and duplicates are dropped", () => {
  const filters = parseFilters(new URLSearchParams("colour=red&skill=a,a,,b&levelMin=-3&sort=bogus&page=x"));
  assert.deepEqual(filters.facets, { skill: ["a", "b"] });
  assert.equal(filters.levelMin, undefined);
  assert.equal(filters.sort, "new");
  assert.equal(filters.page, 1);
});

test("toggling a facet value resets the page and drops empty kinds", () => {
  let filters = parseFilters(new URLSearchParams("skill=a&page=3"));
  filters = toggleFacet(filters, "skill", "b");
  assert.deepEqual(filters.facets.skill, ["a", "b"]);
  assert.equal(filters.page, 1);
  filters = toggleFacet(toggleFacet(filters, "skill", "a"), "skill", "b");
  assert.equal(filters.facets.skill, undefined);
  assert.equal(formatFilters(filters).toString(), "");
});
