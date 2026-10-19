import { env } from "cloudflare:workers";
import { getTableColumns, getTableName, is } from "drizzle-orm";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import * as schema from "../../src/worker/db/schema";

const tables: SQLiteTable[] = Object.values(schema).filter((v) => is(v, SQLiteTable));

describe("Drizzle schema mirrors migrations", () => {
  it("covers all 15 tables", () => {
    expect(tables).toHaveLength(15);
  });

  for (const table of tables) {
    it(`columns match for ${getTableName(table)}`, async () => {
      const name = getTableName(table);
      const { results } = await env.DB.prepare(`PRAGMA table_info(${name})`).all<{
        name: string;
      }>();
      const dbCols = results.map((r) => r.name).sort();
      const drizzleCols = Object.values(getTableColumns(table))
        .map((c) => c.name)
        .sort();
      expect(drizzleCols).toEqual(dbCols);
    });
  }
});
