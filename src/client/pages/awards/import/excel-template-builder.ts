import { awardTypesFor, variantsFor } from "../../../../shared/award-type-rules";
import {
  CATALOG_HEADERS,
  IMPORT_COLUMNS,
  TEMPLATE_CATALOG_SHEET,
  TEMPLATE_MAIN_SHEET,
} from "../../../../shared/import/import-column-definitions";
import { normalizeText } from "../../../../shared/normalize-text";
import type { MasterDataDto, UnitDto } from "../../../../shared/schemas/master-data-dto";
import { loadXlsx } from "./excel-file-reader";

export const TEMPLATE_FILE_NAME = "mau-import-khen-thuong.xlsx";

type Cell = string | number;
export interface TemplateSheets {
  main: Cell[][];
  catalog: string[][];
}

const nameOf = (list: readonly { name: string }[]) => list.map((x) => x.name);

/** Rows below the header of sheet "Danh mục": one column per list, padded to the longest. */
function catalogRows(master: MasterDataDto): string[][] {
  const rewards = awardTypesFor(master, "CA_NHAN", "KHEN_THUONG");
  const columns: string[][] = [
    ["Tập thể", "Cá nhân"],
    ["Danh hiệu", "Khen thưởng", "Xếp loại cán bộ"],
    nameOf(awardTypesFor(master, "TAP_THE", "DANH_HIEU")),
    nameOf(awardTypesFor(master, "CA_NHAN", "DANH_HIEU")),
    [
      ...nameOf(rewards.filter((t) => !t.requires_variant)),
      ...rewards
        .filter((t) => t.requires_variant)
        .flatMap((t) => nameOf(variantsFor(master, t.id))),
    ],
    nameOf(awardTypesFor(master, "CA_NHAN", "XEP_LOAI")),
    nameOf(master.units),
    master.units.flatMap((u) => u.teams.map((t) => `${u.name}: ${t.name}`)),
    nameOf(master.ranks),
    nameOf(master.positions),
    nameOf(master.authorities),
  ];
  const height = Math.max(...columns.map((c) => c.length));
  return Array.from({ length: height }, (_, i) => columns.map((c) => c[i] ?? ""));
}

/** Entry of `list` named `name` (BR-07 normalized), else the first one: examples use real catalog names. */
function pick<T extends { name: string }>(list: readonly T[], name: string): T | undefined {
  return list.find((x) => normalizeText(x.name) === normalizeText(name)) ?? list[0];
}

/** 4 example rows mirroring the sample file, built from live data so that they pass the validator. */
function exampleRows(master: MasterDataDto): Cell[][] {
  const unit = (name: string) => pick(master.units, name);
  const authority = (id?: number) => master.authorities.find((a) => a.id === id)?.name ?? "";
  const authorityNamed = (name: string) => pick(master.authorities, name)?.name ?? "";
  const rank = (name: string) => pick(master.ranks, name)?.name ?? "";
  const position = (name: string) => pick(master.positions, name)?.name ?? "";
  const team = (u: UnitDto | undefined, name: string) =>
    (u?.teams.find((t) => normalizeText(t.name) === normalizeText(name)) ?? u?.teams[0])?.name ??
    "";

  const title = pick(awardTypesFor(master, "CA_NHAN", "DANH_HIEU"), "Chiến sĩ thi đua cơ sở");
  const reward = pick(
    awardTypesFor(master, "TAP_THE", "KHEN_THUONG").filter((t) => !t.requires_variant),
    "Bằng khen Bộ Công an",
  );
  const medal =
    master.award_variants.find(
      (v) => normalizeText(v.name) === "huân chương bảo vệ tổ quốc hạng ba",
    ) ?? master.award_variants[0];
  const rating = pick(awardTypesFor(master, "CA_NHAN", "XEP_LOAI"), "Hoàn thành xuất sắc nhiệm vụ");
  const personalUnit = unit("Phòng 7");
  const collectiveUnit = unit("Phòng 6");
  const person = (name: string, r: string, p: string, u?: UnitDto, t = ""): Cell[] => [
    "Cá nhân",
    name,
    rank(r),
    position(p),
    u?.name ?? "",
    u && t ? team(u, t) : "",
  ];
  return [
    [
      ...person("Nguyễn Văn A", "Đại tá", "Trưởng phòng", personalUnit, "Đội Dẫn đoàn số 1"),
      "Danh hiệu",
      title?.name ?? "",
      2026,
      "125/QĐ-C08-P1",
      "15/09/2026",
      authority(title?.default_authority_id),
      'Có thành tích trong phong trào thi đua "Vì an ninh Tổ quốc" năm 2026',
      "",
    ],
    [
      "Tập thể",
      "",
      "",
      "",
      collectiveUnit?.name ?? "",
      team(collectiveUnit, "Đội CSGT đường bộ cao tốc số 1"),
      "Khen thưởng",
      reward?.name ?? "",
      2026,
      "4521/QĐ-BCA",
      "20/09/2026",
      authority(reward?.default_authority_id),
      "Có thành tích xuất sắc trong đợt cao điểm bảo đảm trật tự an toàn giao thông",
      "",
    ],
    [
      ...person("Nguyễn Văn B", "Thiếu tá", "Cán bộ", personalUnit, "Đội Dẫn đoàn số 1"),
      "Khen thưởng",
      medal?.name ?? "",
      2026,
      "1580/QĐ-CTN",
      "02/09/2026",
      authorityNamed("Chủ tịch nước"),
      "Có thành tích đặc biệt xuất sắc trong công tác bảo đảm an ninh trật tự",
      "",
    ],
    [
      ...person("Nguyễn Văn C", "Thiếu tá", "Cán bộ", unit("Phòng 5")),
      "Xếp loại cán bộ",
      rating?.name ?? "",
      2026,
      "126/QĐ-C08-P1",
      "30/12/2026",
      authority(rating?.default_authority_id),
      "Xếp loại cán bộ năm 2026",
      "",
    ],
  ];
}

/** Both sheets as plain arrays (header + examples; header + valid values), layout of docs/import-template.xlsx. */
export function buildTemplateSheets(master: MasterDataDto): TemplateSheets {
  return {
    main: [IMPORT_COLUMNS.map((c) => c.header), ...exampleRows(master)],
    catalog: [[...CATALOG_HEADERS], ...catalogRows(master)],
  };
}

/** Workbook (2 sheets) as an .xlsx byte array. */
export async function buildTemplateWorkbookBytes(sheets: TemplateSheets): Promise<Uint8Array> {
  const XLSX = await loadXlsx();
  const main = XLSX.utils.aoa_to_sheet(sheets.main);
  main["!cols"] = IMPORT_COLUMNS.map((c) => ({ wch: c.header.length < 12 ? 14 : 28 }));
  const catalog = XLSX.utils.aoa_to_sheet(sheets.catalog);
  catalog["!cols"] = CATALOG_HEADERS.map(() => ({ wch: 34 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, main, TEMPLATE_MAIN_SHEET);
  XLSX.utils.book_append_sheet(wb, catalog, TEMPLATE_CATALOG_SHEET);
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

/** Generates the template from live master data and triggers the browser download. */
export async function downloadImportTemplate(master: MasterDataDto): Promise<void> {
  const bytes = await buildTemplateWorkbookBytes(buildTemplateSheets(master));
  const blob = new Blob([bytes as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = TEMPLATE_FILE_NAME;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
