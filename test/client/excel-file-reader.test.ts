import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  IMPORT_MAX_BYTES,
  ImportFileError,
  readImportFile,
} from "../../src/client/pages/awards/import/excel-file-reader";
import {
  buildTemplateSheets,
  buildTemplateWorkbookBytes,
} from "../../src/client/pages/awards/import/excel-template-builder";
import { buildImportLookups } from "../../src/shared/import/import-lookup-maps";
import { validateImportRow } from "../../src/shared/import/import-row-validator";
import { master, officerOption } from "./helpers/award-fixtures";
import {
  csvFile,
  HEADERS,
  sheetRow,
  xlsxFile,
  xlsxFileWithExcelDate,
} from "./helpers/import-file-builders";

const officers = [
  officerOption(),
  officerOption({ id: 6, code: "CB006", full_name: "Trần Thị Bình", team_id: 2 }),
];

const messageOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ImportFileError);
    return (e as Error).message;
  }
  throw new Error("expected rejection");
};

describe("template builder -> file reader round trip", () => {
  it("template has both sheets with the doc layout and 3 rows that validate as is", async () => {
    const sheets = buildTemplateSheets(master, officers);
    expect(sheets.main[0]).toEqual(HEADERS);
    expect(sheets.catalog[0]).toHaveLength(9);
    expect(sheets.catalog[0]?.[6]).toBe("Đội (Đơn vị: Đội)");
    const bytes = await buildTemplateWorkbookBytes(sheets);

    const wb = XLSX.read(bytes, { type: "array" });
    expect(wb.SheetNames).toEqual(["Khen thưởng", "Danh mục"]);
    const catalog = XLSX.utils.sheet_to_json<string[]>(wb.Sheets["Danh mục"] as XLSX.WorkSheet, {
      header: 1,
    });
    expect(catalog.flat()).toEqual(
      expect.arrayContaining(["Phòng 6: Đội cao tốc 1", "CB005", "Trần Thị Bình", "Giấy khen"]),
    );
    expect(catalog.flat()).toContain("Huân chương Chiến công hạng Nhất");

    const parsed = await readImportFile(
      new File([bytes as BlobPart], "mau.xlsx", { type: "application/octet-stream" }),
    );
    expect(parsed.rows).toHaveLength(3);
    const lk = buildImportLookups(master, officers);
    for (const row of parsed.rows) {
      expect(validateImportRow(row, lk).errors, `row ${row.row_number}`).toEqual([]);
    }
  });
});

describe("readImportFile", () => {
  it("reads rows with their sheet row numbers, skipping blank rows and keeping codes as text", async () => {
    const parsed = await readImportFile(
      xlsxFile([HEADERS, sheetRow(), HEADERS.map(() => ""), sheetRow({ "Mã cán bộ": "007" })]),
    );
    expect(parsed.rows.map((r) => r.row_number)).toEqual([2, 4]);
    expect(parsed.rows[1]?.officer_code).toBe("007");
    expect(parsed.rows[0]?.year).toBe("2026");
  });

  it("matches headers regardless of case, spacing and column order; optional columns may be absent", async () => {
    const headers = ["  năm ", ...HEADERS.filter((h) => h !== "Năm" && h !== "Ghi chú")].map((h) =>
      h.toUpperCase(),
    );
    const base = sheetRow();
    const row = [
      "2026",
      ...base.filter((_, i) => HEADERS[i] !== "Năm" && HEADERS[i] !== "Ghi chú"),
    ];
    const parsed = await readImportFile(xlsxFile([headers, row as string[]]));
    expect(parsed.rows[0]).toMatchObject({ year: "2026", unit: "Phòng 6", note: "" });
  });

  it("converts Excel date cells to ISO dates without time-zone drift", async () => {
    const parsed = await readImportFile(xlsxFileWithExcelDate(2026, 9, 15));
    expect(parsed.rows[0]?.decision_date).toBe("2026-09-15");
  });

  it("keeps dd/mm/yyyy text of a CSV untouched (no US date guessing) and reads UTF-8", async () => {
    const parsed = await readImportFile(
      csvFile([HEADERS, sheetRow({ "Ngày quyết định": "02/09/2026" }) as string[]]),
    );
    expect(parsed.rows[0]).toMatchObject({
      decision_date: "02/09/2026",
      award_name: "Chiến sĩ thi đua cơ sở",
    });
    expect(parsed.warnings).toEqual([]);
  });

  it("warns about replacement characters in a CSV", async () => {
    const parsed = await readImportFile(
      csvFile([HEADERS, sheetRow({ "Ghi chú": "l�i" }) as string[]]),
    );
    expect(parsed.warnings).toHaveLength(1);
  });

  it("rejects a file missing required columns and lists them", async () => {
    const headers = HEADERS.filter((h) => h !== "Năm" && h !== "Số quyết định");
    expect(await messageOf(readImportFile(xlsxFile([headers, headers.map(() => "x")])))).toBe(
      "File thiếu cột: Năm, Số quyết định. Hãy dùng file mẫu để có đúng tên cột.",
    );
  });

  it("rejects header-only, wrong extension, too big and too many rows", async () => {
    expect(await messageOf(readImportFile(xlsxFile([HEADERS])))).toContain("không có dòng dữ liệu");
    expect(await messageOf(readImportFile(new File(["x"], "a.pdf")))).toContain(".xlsx");
    const big = new File(["x"], "big.xlsx");
    Object.defineProperty(big, "size", { value: IMPORT_MAX_BYTES + 1 });
    expect(await messageOf(readImportFile(big))).toContain("5 MB");
    const many = Array.from({ length: 1001 }, () => sheetRow());
    expect(await messageOf(readImportFile(xlsxFile([HEADERS, ...many])))).toContain("1.000");
    const exactly = Array.from({ length: 1000 }, () => sheetRow());
    expect((await readImportFile(xlsxFile([HEADERS, ...exactly]))).rows).toHaveLength(1000);
  });

  it("rejects bytes that are not a spreadsheet (SheetJS falls back to text -> no header columns)", async () => {
    const msg = await messageOf(readImportFile(new File([new Uint8Array([1, 2, 3])], "x.xlsx")));
    expect(msg).toContain("File thiếu cột");
  });
});
