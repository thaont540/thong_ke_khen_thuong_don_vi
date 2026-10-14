import type { OfficerInput } from "../../shared/schemas/officer-schemas";
import { AppError } from "../lib/app-error";

const BADGE_TAKEN = "Số hiệu đã tồn tại";

/** Rank/position/unit must exist and the team must belong to the unit (BR-02 trigger mirrored for a clean 4xx). */
export async function assertOfficerRefs(d1: D1Database, i: OfficerInput): Promise<void> {
  const row = await d1
    .prepare(
      `SELECT (SELECT COUNT(*) FROM ranks WHERE id = ?) AS r,
              (SELECT COUNT(*) FROM positions WHERE id = ?) AS p,
              (SELECT COUNT(*) FROM units WHERE id = ?) AS u,
              (SELECT COUNT(*) FROM teams WHERE id = ? AND unit_id = ?) AS t`,
    )
    .bind(i.rank_id, i.position_id, i.unit_id, i.team_id, i.unit_id)
    .first<{ r: number; p: number; u: number; t: number }>();
  const fields: Record<string, string> = {};
  if (!row?.r) fields.rank_id = "Cấp bậc không hợp lệ";
  if (!row?.p) fields.position_id = "Chức vụ không hợp lệ";
  if (!row?.u) fields.unit_id = "Đơn vị không hợp lệ";
  if (Object.keys(fields).length > 0) throw AppError.validation("Dữ liệu không hợp lệ", fields);
  if (i.team_id !== null && !row?.t) {
    throw AppError.constraint("Đội không thuộc đơn vị của cán bộ");
  }
}

/** BR-06: badge unique among non-deleted officers (`exceptId` = the officer being edited). */
export async function assertBadgeFree(
  d1: D1Database,
  badge: string,
  exceptId: number | null,
): Promise<void> {
  const hit = await d1
    .prepare("SELECT id FROM officers WHERE badge_number = ? AND deleted_at IS NULL AND id <> ?")
    .bind(badge, exceptId ?? 0)
    .first();
  if (hit) throw AppError.conflict(BADGE_TAKEN, { badge_number: BADGE_TAKEN });
}

export const badgeTakenError = () => AppError.conflict(BADGE_TAKEN, { badge_number: BADGE_TAKEN });
