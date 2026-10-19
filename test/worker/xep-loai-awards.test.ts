import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { awardTypesFor, validateAwardChoice } from "../../src/shared/award-type-rules";
import { masterDataDtoSchema } from "../../src/shared/schemas/master-data-dto";
import { listAwards } from "../../src/worker/services/awards-list-query-service";
import { errorOf } from "./helpers/auth-helpers";
import {
  count,
  insertOfficer,
  personalBody,
  putAward,
  send,
  setupAwardTest,
} from "./helpers/award-test-helpers";
import { insertAward, SEED } from "./helpers/test-fixtures";

const db = env.DB;
const DUP = "Cán bộ đã có xếp loại năm này";
let editor: string;

beforeEach(async () => {
  ({ editor } = await setupAwardTest());
  await insertOfficer(db, { id: 1, unitId: SEED.unitP6, teamId: SEED.teamP6Ct1 });
  await insertOfficer(db, { id: 2, unitId: SEED.unitP1 });
});

const rating = (officerId: number, year: number, type: number = SEED.typeXepLoaiXs, id?: number) =>
  insertAward(db, { ...(id ? { id } : {}), officerId, awardTypeId: type, year });

describe("XEP_LOAI uniqueness trigger (one rating per officer per year)", () => {
  it("blocks a second non-deleted rating of the same officer and year, whatever the level", async () => {
    await rating(1, 2025);
    await expect(rating(1, 2025, SEED.typeXepLoaiTot)).rejects.toThrow(DUP);
    await expect(rating(1, 2025)).rejects.toThrow(DUP);
    expect(await count("SELECT COUNT(*) n FROM awards")).toBe(1);
  });

  it("allows other years, other officers and non-rating awards in the same year", async () => {
    await rating(1, 2025);
    await rating(1, 2026);
    await rating(2, 2025);
    await insertAward(db, { officerId: 1, awardTypeId: SEED.typeCstdCoSo, year: 2025 });
    await insertAward(db, { officerId: 1, awardTypeId: SEED.typeCstdCoSo, year: 2025 });
    expect(await count("SELECT COUNT(*) n FROM awards")).toBe(5);
  });

  it("update: moving into an occupied (officer, year) or switching a CSTD award to a rating aborts", async () => {
    await rating(1, 2025, SEED.typeXepLoaiXs, 1);
    await rating(1, 2026, SEED.typeXepLoaiXs, 2);
    await insertAward(db, { id: 3, officerId: 1, awardTypeId: SEED.typeCstdCoSo, year: 2025 });
    await expect(db.prepare("UPDATE awards SET year = 2025 WHERE id = 2").run()).rejects.toThrow(
      DUP,
    );
    await expect(
      db.prepare("UPDATE awards SET award_type_id = ? WHERE id = 3").bind(SEED.typeXepLoaiHt).run(),
    ).rejects.toThrow(DUP);
    await expect(
      db.prepare("UPDATE awards SET officer_id = 2, year = 2025 WHERE id = 2").run(),
    ).resolves.toBeTruthy();
    // editing the rating itself (same year) is not a conflict with itself
    await db
      .prepare("UPDATE awards SET award_type_id = ? WHERE id = 1")
      .bind(SEED.typeXepLoaiTot)
      .run();
  });

  it("soft-deleted ratings do not block; un-deleting one into a taken slot does", async () => {
    await rating(1, 2025, SEED.typeXepLoaiXs, 1);
    await db.prepare("UPDATE awards SET deleted_at = datetime('now') WHERE id = 1").run();
    await rating(1, 2025, SEED.typeXepLoaiTot, 2);
    await expect(
      db.prepare("UPDATE awards SET deleted_at = NULL WHERE id = 1").run(),
    ).rejects.toThrow(DUP);
  });

  it("insert of an already soft-deleted rating is allowed", async () => {
    await rating(1, 2025);
    await db
      .prepare(
        `INSERT INTO awards (subject, officer_id, unit_id, award_type_id, year, decision_number,
           decision_number_search, decision_date, authority_id, achievement, deleted_at)
         VALUES ('CA_NHAN', 1, ?, ?, 2025, 'x', 'x', '2025-01-01', ?, 'x', datetime('now'))`,
      )
      .bind(SEED.unitP6, SEED.typeXepLoaiTot, SEED.authorityDv)
      .run();
    expect(await count("SELECT COUNT(*) n FROM awards")).toBe(2);
  });

  it("a rating cannot belong to a collective subject (type scope trigger)", async () => {
    await expect(
      insertAward(db, { subject: "TAP_THE", awardTypeId: SEED.typeXepLoaiXs }),
    ).rejects.toThrow("Danh hiệu / khen thưởng không áp dụng cho đối tượng này");
  });
});

describe("XEP_LOAI via the API", () => {
  it("creates a rating; the second one for the same year is a 422 with the trigger message", async () => {
    const body = personalBody(1, { award_type_id: SEED.typeXepLoaiXs, year: 2025 });
    expect((await send(editor, "POST", "/api/awards", body)).status).toBe(201);
    const dup = await send(editor, "POST", "/api/awards", {
      ...body,
      award_type_id: SEED.typeXepLoaiTot,
      confirm_duplicate: true,
    });
    expect(dup.status).toBe(422);
    expect((await errorOf(dup)).message).toBe(DUP);
  });

  it("BR-08 still warns when the exact same rating is entered again", async () => {
    const body = personalBody(1, { award_type_id: SEED.typeXepLoaiXs, year: 2025 });
    await send(editor, "POST", "/api/awards", body);
    const res = await send(editor, "POST", "/api/awards", body);
    expect(res.status).toBe(409);
    expect((await errorOf(res)).code).toBe("DUPLICATE");
  });

  it("rejects a rating for a collective with a field-level 422", async () => {
    const res = await send(editor, "POST", "/api/awards", {
      subject: "TAP_THE",
      unit_id: SEED.unitP6,
      team_id: null,
      award_type_id: SEED.typeXepLoaiXs,
      year: 2025,
      decision_number: "1/QĐ",
      decision_date: "2025-12-01",
      authority_id: SEED.authorityDv,
      achievement: "x",
    });
    expect(res.status).toBe(422);
  });

  it("editing a rating to another year works unless that year is taken", async () => {
    await send(
      editor,
      "POST",
      "/api/awards",
      personalBody(1, { award_type_id: SEED.typeXepLoaiXs, year: 2024 }),
    );
    const second = (await (
      await send(
        editor,
        "POST",
        "/api/awards",
        personalBody(1, { award_type_id: SEED.typeXepLoaiXs, year: 2025 }),
      )
    ).json()) as { id: number };
    const clash = await putAward(
      editor,
      second.id,
      personalBody(1, { award_type_id: SEED.typeXepLoaiXs, year: 2024 }),
    );
    expect(clash.status).toBe(409); // BR-08 same type/year/officer exists... or the trigger
    const moved = await putAward(
      editor,
      second.id,
      personalBody(1, { award_type_id: SEED.typeXepLoaiXs, year: 2026 }),
    );
    expect(moved.status).toBe(200);
  });
});

describe("XEP_LOAI rules, filter and stats", () => {
  it("matrix: only individuals get XEP_LOAI types; collectives get none", async () => {
    const res = await send(editor, "GET", "/api/master");
    const master = masterDataDtoSchema.parse(await res.json());
    expect(awardTypesFor(master, "CA_NHAN", "XEP_LOAI")).toHaveLength(4);
    expect(awardTypesFor(master, "TAP_THE", "XEP_LOAI")).toHaveLength(0);
    expect(validateAwardChoice(master, "TAP_THE", SEED.typeXepLoaiXs, null)).toBe(
      "SUBJECT_MISMATCH",
    );
    expect(validateAwardChoice(master, "CA_NHAN", SEED.typeXepLoaiXs, null)).toBe("ok");
  });

  it("list filter form=XEP_LOAI and stats.xep_loai (counters path and live-scan path agree)", async () => {
    await rating(1, 2025, SEED.typeXepLoaiXs);
    await rating(2, 2025, SEED.typeXepLoaiHt);
    await insertAward(db, { officerId: 1, awardTypeId: SEED.typeCstdCoSo });
    await insertAward(db, { subject: "TAP_THE", unitId: SEED.unitP6 });
    const all = await listAwards(db, { page: 1, size: 10 });
    expect(all.stats).toMatchObject({
      total: 4,
      danh_hieu: 2,
      khen_thuong: 0,
      xep_loai: 2,
      ca_nhan: 3,
    });
    const only = await listAwards(db, { page: 1, size: 10, form: "XEP_LOAI" });
    expect(only.total).toBe(2);
    expect(only.items.every((r) => r.form === "XEP_LOAI")).toBe(true);
    expect(only.stats).toMatchObject({ xep_loai: 2, danh_hieu: 0 });
    // text search uses the live scan instead of award_counters
    const searched = await listAwards(db, { page: 1, size: 10, q: "Cán bộ" });
    expect(searched.stats.xep_loai).toBe(2);
    const viaApi = (await (await send(editor, "GET", "/api/awards?form=XEP_LOAI")).json()) as {
      total: number;
    };
    expect(viaApi.total).toBe(2);
  });
});
