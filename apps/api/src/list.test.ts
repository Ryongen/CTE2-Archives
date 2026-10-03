import assert from "node:assert/strict";
import { test } from "node:test";

import { parseFilters } from "@cob/shared";

import { byVersion, facetQuery, pickedKinds, versionQuery, whereClause } from "./list.ts";

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

test("an unknown version matches builds with none, and the version counts ignore the version filter", () => {
  const filters = parseFilters(new URLSearchParams("version=6.4.13,unknown&skill=a"));
  const where = whereClause(filters);
  assert.match(where.sql, /\(b\.mns_version IN \(\?\) OR b\.mns_version IS NULL\)/);
  assert.deepEqual(where.params, ["skill", "a", "6.4.13"]);
  assert.doesNotMatch(versionQuery(filters).sql, /mns_version IN/);
  assert.deepEqual(["6.4.9", "unknown", "6.4.13"].sort(byVersion), ["6.4.13", "6.4.9", "unknown"]);
});
