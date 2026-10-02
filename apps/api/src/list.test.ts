import assert from "node:assert/strict";
import { test } from "node:test";

import { parseFilters } from "@cob/shared";

import { facetQuery, pickedKinds, whereClause } from "./list.ts";

const filters = parseFilters(new URLSearchParams("ascendancy=a&skill=x,y&levelMin=40&q=50%_off"));

test("each picked kind becomes one IN subquery with its values bound", () => {
  const where = whereClause(filters);
  assert.equal(where.sql.match(/FROM build_facets/g)?.length, 2);
  assert.deepEqual(where.params, ["ascendancy", "a", "skill", "x", "y", 40, "%50\\%\\_off%"]);
});

test("a kind's own facet counts leave its filter out", () => {
  const own = facetQuery(filters, "skill");
  assert.ok(!own.params.includes("x"));
  assert.ok(own.params.includes("a"));
  assert.deepEqual(pickedKinds(filters), ["ascendancy", "skill"]);
});

test("the every-kind query keeps every filter", () => {
  const all = facetQuery(filters);
  assert.ok(all.params.includes("x") && all.params.includes("a"));
});
