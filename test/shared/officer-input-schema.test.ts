import { describe, expect, it } from "vitest";
import { officerInputSchema } from "../../src/shared/schemas/officer-schemas";

describe("officerInputSchema career fields", () => {
  const base = {
    full_name: "Nguyễn Văn A",
    birth_year: 1990,
    badge_number: "123456",
    rank_id: 1,
    position_id: 7,
    unit_id: 6,
  };
  it("career fields are optional and default to null", () => {
    const o = officerInputSchema.parse(base);
    expect(o.joined_month).toBeNull();
    expect(officerInputSchema.parse({ ...base, joined_month: "2015-06" })).toMatchObject({
      joined_month: "2015-06",
    });
  });
  it("birth year and badge number are optional (default null) but still validated when present", () => {
    const { birth_year: _y, badge_number: _b, ...bare } = base;
    expect(officerInputSchema.parse(bare)).toMatchObject({ birth_year: null, badge_number: null });
    expect(officerInputSchema.safeParse({ ...bare, birth_year: 1949 }).success).toBe(false);
    expect(officerInputSchema.safeParse({ ...bare, badge_number: "12345" }).success).toBe(false);
    expect(officerInputSchema.safeParse({ ...bare, badge_number: "" }).success).toBe(false);
  });
  it("joined month before birth year + 16 is only checked when the birth year is known", () => {
    const { birth_year: _y, ...noBirth } = base;
    expect(officerInputSchema.safeParse({ ...noBirth, joined_month: "1960-01" }).success).toBe(
      true,
    );
  });
  it("rating_id is no longer part of the input (stripped)", () => {
    expect(officerInputSchema.parse({ ...base, rating_id: 2 })).not.toHaveProperty("rating_id");
  });
  const messageFor = (over: object) => {
    const r = officerInputSchema.safeParse({ ...base, ...over });
    return r.success ? null : r.error.issues[0]?.message;
  };
  it("rejects malformed, future and under-16 joined months with Vietnamese messages", () => {
    expect(messageFor({ joined_month: "2015-13" })).toBe("Tháng năm vào ngành không hợp lệ");
    expect(messageFor({ joined_month: "2999-01" })).toBe(
      "Tháng năm vào ngành không được ở tương lai",
    );
    expect(messageFor({ joined_month: "2005-12" })).toBe(
      "Tháng năm vào ngành phải sau năm sinh ít nhất 16 năm",
    );
    expect(messageFor({ joined_month: "2006-01" })).toBeNull(); // 1990 + 16
  });
});
