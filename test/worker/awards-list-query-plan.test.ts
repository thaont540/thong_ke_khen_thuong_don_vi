import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
  AWARD_ORDER,
  AWARD_RECORD_COLUMNS,
  AWARD_RECORD_JOINS,
} from "../../src/worker/services/award-record-sql";
import { buildAwardFilter } from "../../src/worker/services/award-search-filter-builder";

const plan = async (query: Parameters<typeof buildAwardFilter>[0]) => {
  const { where, binds } = buildAwardFilter(query);
  const { results } = await env.DB.prepare(
    `EXPLAIN QUERY PLAN SELECT ${AWARD_RECORD_COLUMNS} ${AWARD_RECORD_JOINS} WHERE ${where} ${AWARD_ORDER} LIMIT 10 OFFSET 0`,
  )
    .bind(...binds)
    .all<{ detail: string }>();
  return results.map((r) => r.detail).join("\n");
};

describe("F01 query plans (D1 read cost)", () => {
  it("unfiltered list walks ix_awards_list without a sort step", async () => {
    const p = await plan({ page: 1, size: 10 });
    expect(p).toContain("ix_awards_list");
    expect(p).not.toContain("TEMP B-TREE");
  });

  it("unit/team filter uses ix_awards_unit_team", async () => {
    expect(await plan({ page: 1, size: 10, unit_id: 6, team_id: 1 })).toContain(
      "ix_awards_unit_team",
    );
  });
});
