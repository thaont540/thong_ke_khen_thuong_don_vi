import type { MasterDataDto } from "../../../src/shared/schemas/master-data-dto";
import type { OfficerListItem } from "../../../src/shared/schemas/officer-schemas";
import { makeMe } from "./render-with-providers";

export const admin = makeMe("ADMIN");
export const master: MasterDataDto = {
  units: [
    {
      id: 1,
      code: "P1",
      name: "Phòng 1",
      kind: "PHONG",
      description: null,
      sort_order: 1,
      teams: [{ id: 11, unit_id: 1, code: "P1-T1", name: "Đội một", sort_order: 1 }],
    },
    {
      id: 2,
      code: "P2",
      name: "Phòng 2",
      kind: "PHONG",
      description: null,
      sort_order: 2,
      teams: [],
    },
  ],
  ranks: [{ id: 3, code: "R3", name: "Đại úy", rank_group: "CAP_UY", sort_order: 1 }],
  positions: [{ id: 4, code: "P4", name: "Cán bộ", level: "CAN_BO", sort_order: 1 }],
  authorities: [],
  award_types: [],
  award_variants: [],
};
export const officer = (over: Partial<OfficerListItem> = {}): OfficerListItem => ({
  id: 7,
  code: "CB007",
  full_name: "Nguyễn Văn An",
  birth_year: 1990,
  badge_number: "123456",
  rank_id: 3,
  position_id: 4,
  unit_id: 1,
  team_id: 11,
  joined_month: null,
  current_rating: null,
  award_count: 3,
  ...over,
});
export const page = (items: OfficerListItem[]) => ({
  body: { items, total: items.length, page: 1, size: 10 },
});
export const base = (items = [officer()]) => ({
  "GET /api/me": { body: admin },
  "GET /api/master": { body: master },
  "GET /api/officers": page(items),
});
