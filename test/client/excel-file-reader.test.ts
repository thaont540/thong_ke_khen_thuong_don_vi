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
import { validateImportRows } from "../../src/shared/import/import-rows-validator";
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
  it("template has both sheets with the new layout and 4 example rows that validate as is", async () => {
    const sheets = buildTemplateSheets(master);
    expect(sheets.main[0]).toEqual(HEADERS);
    expect(sheets.catalog[0]).toEqual([
      "Đối tượng",
      "Hình thức",
      "Danh hiệu tập thể",
      "Danh hiệu cá nhân",
      "Hình thức khen thưởng",
      "Xếp loại cán bộ",
      "Đơn vị",
      "Đội (Đơn vị: Đội)",
      "Cấp bậc",
      "Chức vụ",
      "Cấp quyết định",
    ]);
    const bytes = await buildTemplateWorkbookBytes(sheets);

    const wb = XLSX.read(bytes, { type: "array" });
    expect(wb.SheetNames).toEqual(["Khen thưởng", "Danh mục"]);
    const catalog = XLSX.utils.sheet_to_json<string[]>(wb.Sheets["Danh mục"] as XLSX.WorkSheet, {
      header: 1,
    });
    expect(catalog.flat()).toEqual(
      expect.arrayContaining([
        "Phòng 6: Đội cao tốc 1",
        "Giấy khen",
        "Xếp loại cán bộ",
        "Hoàn thành xuất sắc nhiệm vụ",
        "Đại úy",
        "Cán bộ",
        "Thủ trưởng đơn vị",
        "Huân chương Chiến công hạng Nhất",
      ]),
    );
    expect(catalog.flat()).not.toContain("CB005");
    expect(sheets.main.slice(1).map((r) => r[6])).toEqual([
      "Danh hiệu",
      "Khen thưởng",
      "Khen thưởng",
      "Xếp loại cán bộ",
    ]);

    const parsed = await readImportFile(
      new File([bytes as BlobPart], "mau.xlsx", { type: "application/octet-stream" }),
    );
    expect(parsed.rows).toHaveLength(4);
    const checks = validateImportRows(parsed.rows, buildImportLookups(master, officers));
    for (const [i, check] of checks.entries()) expect(check.errors, `row ${i + 2}`).toEqual([]);
    // Individuals of the examples are new people: they would be created on import.
    expect(checks.map((c) => c.newOfficer !== null)).toEqual([true, false, true, true]);
  });
});

describe("readImportFile", () => {
  it("reads rows with their sheet row numbers, skipping blank rows and keeping numeric-looking names as text", async () => {
    const parsed = await readImportFile(
      xlsxFile([HEADERS, sheetRow(), HEADERS.map(() => ""), sheetRow({ "Họ và tên": "007" })]),
    );
    expect(parsed.rows.map((r) => r.row_number)).toEqual([2, 4]);
    expect(parsed.rows[1]?.full_name).toBe("007");
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

  it("rejects an old file (Mã cán bộ, no Họ và tên / Cấp bậc / Chức vụ) as missing columns", async () => {
    const old = HEADERS.filter((h) => !["Họ và tên", "Cấp bậc", "Chức vụ"].includes(h));
    const headers = [old[0] as string, "Mã cán bộ", ...old.slice(1)];
    expect(await messageOf(readImportFile(xlsxFile([headers, headers.map(() => "x")])))).toBe(
      "File thiếu cột: Họ và tên, Cấp bậc, Chức vụ. Hãy dùng file mẫu để có đúng tên cột.",
    );
  });

  it("rejects header-only, wrong extension, too big and too many rows", async () => {
    expect(await messageOf(readImportFile(xlsxFile([HEADERS])))).toContain("không có dòng dữ liệu");
    expect(await messageOf(readImportFile(new File(["x"], "a.pdf")))).toContain(".xlsx");
    const big = new File(["x"], "big.xlsx");
    Object.defineProperty(big, "size", { value: IMPORT_MAX_BYTES + 1 });
    expect(await messageOf(readImportFile(big))).toBe("File vượt quá 5 MB");
    const many = Array.from({ length: 101 }, () => sheetRow());
    expect(await messageOf(readImportFile(xlsxFile([HEADERS, ...many])))).toBe(
      "File có 101 dòng, tối đa 100 dòng mỗi lần nhập",
    );
    const exactly = Array.from({ length: 100 }, () => sheetRow());
    expect((await readImportFile(xlsxFile([HEADERS, ...exactly]))).rows).toHaveLength(100);
  });

  it("parses at most header + 101 rows (sheetRows cap) yet reports the declared row count", async () => {
    const many = Array.from({ length: 500 }, () => sheetRow());
    expect(await messageOf(readImportFile(xlsxFile([HEADERS, ...many])))).toBe(
      "File có 500 dòng, tối đa 100 dòng mỗi lần nhập",
    );
  });

  it("rejects a sheet whose data hides behind blank rows past the read cap (no silent drop)", async () => {
    const blanks = Array.from({ length: 110 }, () => [] as string[]);
    const msg = await messageOf(
      readImportFile(xlsxFile([HEADERS, sheetRow(), ...blanks, sheetRow()])),
    );
    expect(msg).toMatch(/^File có \d+ dòng, tối đa 100 dòng mỗi lần nhập$/);
  });

  it("rejects bytes that are not a spreadsheet (SheetJS falls back to text -> no header columns)", async () => {
    const msg = await messageOf(readImportFile(new File([new Uint8Array([1, 2, 3])], "x.xlsx")));
    expect(msg).toContain("File thiếu cột");
  });
});
