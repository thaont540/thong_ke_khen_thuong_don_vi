import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import {
  awardTypesFor,
  defaultAuthorityId,
  requiresVariant,
  validateAwardChoice,
  variantsFor,
} from "../../src/shared/award-type-rules";
import type { MasterDataDto } from "../../src/shared/schemas/master-data-dto";
import { getMasterData } from "../../src/worker/services/master-data-service";

let master: MasterDataDto;
beforeAll(async () => {
  master = await getMasterData(env.DB);
});

const names = (ts: { name: string }[]) => ts.map((t) => t.name);
const typeByCode = (code: string) => {
  const t = master.award_types.find((x) => x.code === code);
  if (!t) throw new Error(`missing ${code}`);
  return t;
};

describe("awardTypesFor (spec §2 matrix)", () => {
  it("Tập thể + Danh hiệu -> 4 collective titles", () => {
    const r = awardTypesFor(master, "TAP_THE", "DANH_HIEU");
    expect(names(r)).toEqual([
      "Cờ Thi đua của Chính phủ",
      "Cờ thi đua của Bộ Công an",
      "Đơn vị quyết thắng",
      "Đơn vị tiên tiến",
    ]);
  });

  it("Cá nhân + Danh hiệu -> 4 individual titles", () => {
    const r = awardTypesFor(master, "CA_NHAN", "DANH_HIEU");
    expect(names(r)).toEqual([
      "Chiến sĩ thi đua toàn quốc",
      "Chiến sĩ thi đua toàn lực lượng",
      "Chiến sĩ thi đua cơ sở",
      "Chiến sĩ tiên tiến",
    ]);
  });

  it("Khen thưởng -> same 4 for both subjects", () => {
    const a = awardTypesFor(master, "TAP_THE", "KHEN_THUONG");
    const b = awardTypesFor(master, "CA_NHAN", "KHEN_THUONG");
    expect(a).toHaveLength(4);
    expect(names(a)).toEqual(names(b));
    expect(names(a)).toContain("Huân chương");
  });
});

describe("defaults and variants (spec §2)", () => {
  const authorityCode = (code: string) =>
    master.authorities.find((a) => a.id === defaultAuthorityId(typeByCode(code)))?.code;

  it("default authority per type", () => {
    expect(authorityCode("HUAN_CHUONG")).toBe("CTN");
    for (const c of ["CO_TD_CP", "CSTD_TOAN_QUOC", "BK_TTG"]) expect(authorityCode(c)).toBe("TTG");
    for (const c of ["CO_TD_BCA", "CSTD_TOAN_LL", "BK_BCA"]) expect(authorityCode(c)).toBe("BCA");
    for (const c of ["DV_QUYET_THANG", "DV_TIEN_TIEN", "CSTD_CO_SO", "CS_TIEN_TIEN", "GIAY_KHEN"])
      expect(authorityCode(c)).toBe("DV");
  });

  it("only Huân chương requires a variant, with 6 variants", () => {
    const req = master.award_types.filter(requiresVariant).map((t) => t.code);
    expect(req).toEqual(["HUAN_CHUONG"]);
    expect(variantsFor(master, typeByCode("HUAN_CHUONG").id)).toHaveLength(6);
    expect(variantsFor(master, typeByCode("GIAY_KHEN").id)).toHaveLength(0);
  });

  it("validateAwardChoice mirrors DB triggers", () => {
    const hc = typeByCode("HUAN_CHUONG");
    const cs = typeByCode("CSTD_CO_SO");
    const gk = typeByCode("GIAY_KHEN");
    const v = variantsFor(master, hc.id)[0]?.id ?? 0;
    expect(validateAwardChoice(master, "TAP_THE", cs.id, null)).toBe("SUBJECT_MISMATCH");
    expect(validateAwardChoice(master, "CA_NHAN", hc.id, null)).toBe("VARIANT_REQUIRED");
    expect(validateAwardChoice(master, "CA_NHAN", gk.id, v)).toBe("VARIANT_MISMATCH");
    expect(validateAwardChoice(master, "TAP_THE", hc.id, v)).toBe("ok");
    expect(validateAwardChoice(master, "CA_NHAN", 9999, null)).toBe("UNKNOWN_TYPE");
  });
});
