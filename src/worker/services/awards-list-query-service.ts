import { normalizeText } from "../../shared/normalize-text";
import type { AwardRecord, AwardStats } from "../../shared/schemas/award-schemas";
import type { AwardListQuery } from "../../shared/schemas/list-query-schemas";
import { AppError } from "../lib/app-error";
import { toPageParams } from "../lib/pagination";
import {
  AWARD_ORDER,
  AWARD_RECORD_COLUMNS,
  AWARD_RECORD_JOINS,
  toAwardRecord,
} from "./award-record-sql";
import { buildAwardFilter, type CollectiveNames } from "./award-search-filter-builder";

interface StatsRow {
  total: number;
  danh_hieu: number | null;
  khen_thuong: number | null;
  tap_the: number | null;
  ca_nhan: number | null;
}

async function loadCollectiveNames(d1: D1Database): Promise<CollectiveNames> {
  const [units, teams] = await d1.batch<{ id: number; name: string }>([
    d1.prepare("SELECT id, name FROM units"),
    d1.prepare("SELECT id, name FROM teams"),
  ]);
  return { units: units?.results ?? [], teams: teams?.results ?? [] };
}

/**
 * F01: filtered page + stats of the same filtered set in ONE D1 round trip (2 statements, plus one
 * ~23-row name lookup only while searching). Unfiltered list walks ix_awards_list.
 */
export async function listAwards(d1: D1Database, query: AwardListQuery) {
  const { page, size, limit, offset } = toPageParams(query.page, query.size);
  const names = normalizeText(query.q ?? "") ? await loadCollectiveNames(d1) : undefined;
  const { where, binds } = buildAwardFilter(query, names);

  const [items, stats] = await d1.batch([
    d1
      .prepare(
        `SELECT ${AWARD_RECORD_COLUMNS} ${AWARD_RECORD_JOINS}
         WHERE ${where} ${AWARD_ORDER} LIMIT ? OFFSET ?`,
      )
      .bind(...binds, limit, offset),
    d1
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(t.form = 'DANH_HIEU') AS danh_hieu, SUM(t.form = 'KHEN_THUONG') AS khen_thuong,
                SUM(a.subject = 'TAP_THE') AS tap_the, SUM(a.subject = 'CA_NHAN') AS ca_nhan
         FROM awards a JOIN award_types t ON t.id = a.award_type_id WHERE ${where}`,
      )
      .bind(...binds),
  ]);
  const s = (stats?.results[0] ?? { total: 0 }) as StatsRow;
  const summary: AwardStats = {
    total: s.total,
    danh_hieu: s.danh_hieu ?? 0,
    khen_thuong: s.khen_thuong ?? 0,
    tap_the: s.tap_the ?? 0,
    ca_nhan: s.ca_nhan ?? 0,
  };
  return {
    items: (items?.results ?? []).map(toAwardRecord),
    total: summary.total,
    page,
    size,
    stats: summary,
  };
}

/** F09 edit load. */
export async function getAward(d1: D1Database, id: number): Promise<AwardRecord> {
  const row = await d1
    .prepare(
      `SELECT ${AWARD_RECORD_COLUMNS} ${AWARD_RECORD_JOINS} WHERE a.id = ? AND a.deleted_at IS NULL`,
    )
    .bind(id)
    .first();
  if (!row) throw AppError.notFound("Không tìm thấy bản ghi khen thưởng");
  return toAwardRecord(row);
}
