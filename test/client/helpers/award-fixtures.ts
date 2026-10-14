import type { AwardRecord } from "../../../src/shared/schemas/award-schemas";
import type { MasterDataDto } from "../../../src/shared/schemas/master-data-dto";
import type { OfficerDetail, OfficerOption } from "../../../src/shared/schemas/officer-schemas";

/** Small catalog following spec section 2 (ids are arbitrary but internally consistent). */
export const master: MasterDataDto = {
  units: [
    {
      id: 6,
      code: "P6",
      name: "Phòng 6",
      kind: "PHONG",
      description: null,
      sort_order: 1,
      teams: [
        { id: 1, unit_id: 6, code: "CT1", name: "Đội cao tốc 1", sort_order: 1 },
        { id: 2, unit_id: 6, code: "CT2", name: "Đội cao tốc 2", sort_order: 2 },
      ],
    },
    {
      id: 1,
      code: "P1",
      name: "Phòng 1",
      kind: "PHONG",
      description: null,
      sort_order: 2,
      teams: [],
    },
  ],
  ranks: [{ id: 7, code: "DAI_UY", name: "Đại úy", rank_group: "CAP_UY", sort_order: 1 }],
  positions: [{ id: 7, code: "CAN_BO", name: "Cán bộ", level: "CAN_BO", sort_order: 1 }],
  authorities: [
    { id: 1, code: "CTN", name: "Chủ tịch nước", sort_order: 1 },
    { id: 4, code: "DV", name: "Thủ trưởng đơn vị", sort_order: 4 },
  ],
  award_types: [
    {
      id: 4,
      code: "DV_TIEN_TIEN",
      name: "Đơn vị tiên tiến",
      form: "DANH_HIEU",
      subject_scope: "TAP_THE",
      default_authority_id: 4,
      requires_variant: false,
      sort_order: 4,
    },
    {
      id: 7,
      code: "CSTD_CO_SO",
      name: "Chiến sĩ thi đua cơ sở",
      form: "DANH_HIEU",
      subject_scope: "CA_NHAN",
      default_authority_id: 4,
      requires_variant: false,
      sort_order: 7,
    },
    {
      id: 9,
      code: "HUAN_CHUONG",
      name: "Huân chương",
      form: "KHEN_THUONG",
      subject_scope: "CA_HAI",
      default_authority_id: 1,
      requires_variant: true,
      sort_order: 9,
    },
    {
      id: 12,
      code: "GIAY_KHEN",
      name: "Giấy khen",
      form: "KHEN_THUONG",
      subject_scope: "CA_HAI",
      default_authority_id: 4,
      requires_variant: false,
      sort_order: 12,
    },
  ],
  award_variants: [
    {
      id: 1,
      award_type_id: 9,
      code: "HC1",
      name: "Huân chương Chiến công hạng Nhất",
      sort_order: 1,
    },
  ],
};

export const officerOption = (over: Partial<OfficerOption> = {}): OfficerOption => ({
  id: 5,
  code: "CB005",
  full_name: "Nguyễn Văn An",
  rank_id: 7,
  badge_number: "123456",
  unit_id: 6,
  team_id: 1,
  ...over,
});

export const award = (over: Partial<AwardRecord> = {}): AwardRecord => ({
  id: 11,
  subject: "CA_NHAN",
  officer_id: 5,
  officer_name: "Nguyễn Văn An",
  officer_rank_name: "Đại úy",
  unit_id: 6,
  unit_name: "Phòng 6",
  team_id: 1,
  team_name: "Đội cao tốc 1",
  award_type_id: 7,
  award_type_name: "Chiến sĩ thi đua cơ sở",
  form: "DANH_HIEU",
  award_variant_id: null,
  award_variant_name: null,
  year: 2026,
  decision_number: "125/QĐ-ĐV",
  decision_date: "2026-09-15",
  authority_id: 4,
  authority_name: "Thủ trưởng đơn vị",
  achievement: "Hoàn thành xuất sắc",
  note: null,
  updated_at: "2026-09-15 08:00:00.000",
  ...over,
});

export const collectiveAward = (over: Partial<AwardRecord> = {}): AwardRecord =>
  award({
    id: 12,
    subject: "TAP_THE",
    officer_id: null,
    officer_name: null,
    officer_rank_name: null,
    team_id: null,
    team_name: null,
    award_type_id: 4,
    award_type_name: "Đơn vị tiên tiến",
    decision_number: "10/QĐ",
    ...over,
  });

export const officerDetail = (awards: AwardRecord[] = [award()]): OfficerDetail => ({
  id: 5,
  code: "CB005",
  full_name: "Nguyễn Văn An",
  birth_year: 1990,
  badge_number: "123456",
  rank_id: 7,
  position_id: 7,
  unit_id: 6,
  team_id: 1,
  awards,
});

export const listBody = (items: AwardRecord[], total = items.length, page = 1) => ({
  items,
  total,
  page,
  size: 10,
  stats: { total, danh_hieu: total, khen_thuong: 0, tap_the: 0, ca_nhan: total },
});
