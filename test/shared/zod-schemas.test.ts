import { describe, expect, it } from "vitest";
import { changePasswordRequestSchema } from "../../src/shared/schemas/auth-schemas";
import { importRequestSchema } from "../../src/shared/schemas/award-import-schemas";
import { awardInputSchema } from "../../src/shared/schemas/award-schemas";
import { awardListQuerySchema } from "../../src/shared/schemas/list-query-schemas";
import { officerInputSchema } from "../../src/shared/schemas/officer-schemas";
import { unitUpsertSchema } from "../../src/shared/schemas/unit-schemas";
import { userCreateSchema } from "../../src/shared/schemas/user-schemas";

const awardBase = {
  award_type_id: 7,
  year: 2026,
  decision_number: " 125/QĐ-ĐV ",
  decision_date: "2026-09-15",
  authority_id: 4,
  achievement: "Hoàn thành tốt",
};

describe("awardInputSchema", () => {
  it("individual requires officer_id; trims; defaults null", () => {
    const ok = awardInputSchema.parse({ subject: "CA_NHAN", officer_id: 3, ...awardBase });
    expect(ok.decision_number).toBe("125/QĐ-ĐV");
    expect(ok.award_variant_id).toBeNull();
    expect(ok.note).toBeNull();
    expect(awardInputSchema.safeParse({ subject: "CA_NHAN", ...awardBase }).success).toBe(false);
  });

  it("collective requires unit_id, team optional", () => {
    const ok = awardInputSchema.parse({ subject: "TAP_THE", unit_id: 6, ...awardBase });
    expect(ok.subject === "TAP_THE" && ok.team_id).toBeNull();
    expect(awardInputSchema.safeParse({ subject: "TAP_THE", ...awardBase }).success).toBe(false);
  });

  it("enforces field limits", () => {
    const base = { subject: "TAP_THE", unit_id: 6, ...awardBase };
    expect(awardInputSchema.safeParse({ ...base, year: 1989 }).success).toBe(false);
    expect(awardInputSchema.safeParse({ ...base, year: 2101 }).success).toBe(false);
    expect(awardInputSchema.safeParse({ ...base, decision_number: "x".repeat(51) }).success).toBe(
      false,
    );
    expect(awardInputSchema.safeParse({ ...base, achievement: "x".repeat(2001) }).success).toBe(
      false,
    );
    expect(awardInputSchema.safeParse({ ...base, note: "x".repeat(501) }).success).toBe(false);
    expect(awardInputSchema.safeParse({ ...base, decision_date: "2026-02-30" }).success).toBe(
      false,
    );
    expect(awardInputSchema.safeParse({ ...base, subject: "OTHER" }).success).toBe(false);
  });
});

describe("officerInputSchema", () => {
  const base = {
    full_name: "  Nguyễn   Văn A ",
    birth_year: 1990,
    badge_number: "123456",
    rank_id: 1,
    position_id: 7,
    unit_id: 6,
  };
  it("collapses name spaces, defaults team null", () => {
    const o = officerInputSchema.parse(base);
    expect(o.full_name).toBe("Nguyễn Văn A");
    expect(o.team_id).toBeNull();
  });
  it("rejects bad badge / birth year", () => {
    expect(officerInputSchema.safeParse({ ...base, badge_number: "12345" }).success).toBe(false);
    expect(officerInputSchema.safeParse({ ...base, birth_year: 1949 }).success).toBe(false);
    expect(officerInputSchema.safeParse({ ...base, birth_year: 2011 }).success).toBe(false);
  });
});

describe("user / auth schemas", () => {
  it("username pattern and password length", () => {
    const base = {
      username: "Admin.01",
      full_name: "A",
      role: "ADMIN",
      temp_password: "0123456789",
    };
    expect(userCreateSchema.safeParse(base).success).toBe(true);
    expect(userCreateSchema.safeParse({ ...base, username: "ab" }).success).toBe(false);
    expect(userCreateSchema.safeParse({ ...base, username: "tên có dấu" }).success).toBe(false);
    expect(userCreateSchema.safeParse({ ...base, temp_password: "short" }).success).toBe(false);
  });

  it("change password: min 10, differs, matches", () => {
    const base = {
      current_password: "old-password-1",
      new_password: "new-password-1",
      confirm_password: "new-password-1",
    };
    expect(changePasswordRequestSchema.safeParse(base).success).toBe(true);
    expect(changePasswordRequestSchema.safeParse({ ...base, confirm_password: "x" }).success).toBe(
      false,
    );
    expect(
      changePasswordRequestSchema.safeParse({
        ...base,
        new_password: "old-password-1",
        confirm_password: "old-password-1",
      }).success,
    ).toBe(false);
    expect(
      changePasswordRequestSchema.safeParse({
        ...base,
        new_password: "short",
        confirm_password: "short",
      }).success,
    ).toBe(false);
  });
});

describe("unit, list query, import schemas", () => {
  it("unit upsert normalizes names, defaults teams", () => {
    const u = unitUpsertSchema.parse({ code: "P9", kind: "PHONG", name: " Phòng   9 " });
    expect(u.name).toBe("Phòng 9");
    expect(u.teams).toEqual([]);
    expect(u.description).toBeNull();
  });

  it("list query coerces, ignores empty params, caps size", () => {
    const q = awardListQuerySchema.parse({
      unit_id: "6",
      team_id: "",
      subject: "",
      page: "2",
      size: "50",
    });
    expect(q).toMatchObject({ unit_id: 6, page: 2, size: 50 });
    expect(q.team_id).toBeUndefined();
    expect(q.subject).toBeUndefined();
    expect(awardListQuerySchema.safeParse({ size: "51" }).success).toBe(false);
    expect(awardListQuerySchema.parse({})).toMatchObject({ page: 1, size: 10 });
  });

  it("import lot is capped at 30 rows", () => {
    const row = {
      row_number: 2,
      subject: "Cá nhân",
      unit: "Phòng 6",
      form: "Danh hiệu",
      award_name: "x",
      year: 2026,
      decision_number: "1",
      decision_date: "15/09/2026",
      achievement: "x",
    };
    const mk = (n: number) => ({
      file_name: "f.xlsx",
      total_rows: n,
      rows: Array.from({ length: n }, () => row),
    });
    expect(importRequestSchema.safeParse(mk(30)).success).toBe(true);
    expect(importRequestSchema.safeParse(mk(31)).success).toBe(false);
  });
});
