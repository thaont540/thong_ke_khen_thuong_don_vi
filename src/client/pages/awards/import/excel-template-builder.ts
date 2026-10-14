import { awardTypesFor, variantsFor } from "../../../../shared/award-type-rules";
import {
  CATALOG_HEADERS,
  IMPORT_COLUMNS,
  TEMPLATE_CATALOG_SHEET,
  TEMPLATE_MAIN_SHEET,
} from "../../../../shared/import/import-column-definitions";
import type { ImportOfficer } from "../../../../shared/import/import-lookup-maps";
import type { MasterDataDto } from "../../../../shared/schemas/master-data-dto";
import { loadXlsx } from "./excel-file-reader";

export const TEMPLATE_FILE_NAME = "mau-import-khen-thuong.xlsx";

type Cell = string | number;
export interface TemplateSheets {
  main: Cell[][];
  catalog: string[][];
}

const nameOf = (list: readonly { name: string }[]) => list.map((x) => x.name);

/** Rows below the header of sheet "Danh mục": one column per list, padded to the longest. */
function catalogRows(master: MasterDataDto, officers: readonly ImportOfficer[]): string[][] {
  const rewards = awardTypesFor(master, "CA_NHAN", "KHEN_THUONG");
  const columns: string[][] = [
    ["Tập thể", "Cá nhân"],
    ["Danh hiệu", "Khen thưởng"],
    nameOf(awardTypesFor(master, "TAP_THE", "DANH_HIEU")),
    nameOf(awardTypesFor(master, "CA_NHAN", "DANH_HIEU")),
    [
      ...nameOf(rewards.filter((t) => !t.requires_variant)),
      ...rewards
        .filter((t) => t.requires_variant)
        .flatMap((t) => nameOf(variantsFor(master, t.id))),
    ],
    nameOf(master.units),
    master.units.flatMap((u) => u.teams.map((t) => `${u.name}: ${t.name}`)),
    officers.map((o) => o.code),
    officers.map((o) => o.full_name),
  ];
  const height = Math.max(...columns.map((c) => c.length));
  return Array.from({ length: height }, (_, i) => columns.map((c) => c[i] ?? ""));
}

/** 3 example rows built from live data so that they pass the validator as is. */
function exampleRows(master: MasterDataDto, officers: readonly ImportOfficer[]): Cell[][] {
  const unitName = (id: number) => master.units.find((u) => u.id === id)?.name ?? "";
  const teamName = (id: number | null) =>
    master.units.flatMap((u) => u.teams).find((t) => t.id === id)?.name ?? "";
  const lowestAuthority = master.authorities.at(-1)?.id;
  const titles = awardTypesFor(master, "CA_NHAN", "DANH_HIEU");
  const title = titles.find((t) => t.default_authority_id === lowestAuthority) ?? titles[0];
  const rewards = awardTypesFor(master, "TAP_THE", "KHEN_THUONG").filter(
    (t) => !t.requires_variant,
  );
  const reward = rewards[1] ?? rewards[0];
  const collectiveUnit = master.units.find((u) => u.teams.length > 0) ?? master.units[0];
  const first = officers[0];
  const second = officers[1] ?? first;
  const medal = master.award_variants[2] ?? master.award_variants[0];
  const authority = (id?: number) => master.authorities.find((a) => a.id === id)?.name ?? "";

  const personal = (o: ImportOfficer | undefined, form: string, award: string): Cell[] => [
    "Cá nhân",
    o?.code ?? "",
    o ? unitName(o.unit_id) : "",
    o ? teamName(o.team_id) : "",
    form,
    award,
  ];
  return [
    [
      ...personal(first, "Danh hiệu", title?.name ?? ""),
      2026,
      "125/QĐ-ĐV",
      "15/09/2026",
      "",
      "Hoàn thành xuất sắc nhiệm vụ công tác năm 2026",
      "",
    ],
    [
      "Tập thể",
      "",
      collectiveUnit?.name ?? "",
      collectiveUnit?.teams[0]?.name ?? "",
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
      ...personal(second, "Khen thưởng", medal?.name ?? ""),
      2026,
      "1580/QĐ-CTN",
      "02/09/2026",
      "",
      "Có thành tích đặc biệt xuất sắc trong công tác bảo đảm an ninh trật tự",
      "",
    ],
  ];
}

/** Both sheets as plain arrays (header + examples; header + valid values), layout of docs/import-template.xlsx. */
export function buildTemplateSheets(
  master: MasterDataDto,
  officers: readonly ImportOfficer[],
): TemplateSheets {
  return {
    main: [IMPORT_COLUMNS.map((c) => c.header), ...exampleRows(master, officers)],
    catalog: [[...CATALOG_HEADERS], ...catalogRows(master, officers)],
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

/** Generates the template from live master data + officers and triggers the browser download. */
export async function downloadImportTemplate(
  master: MasterDataDto,
  officers: readonly ImportOfficer[],
): Promise<void> {
  const bytes = await buildTemplateWorkbookBytes(buildTemplateSheets(master, officers));
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
