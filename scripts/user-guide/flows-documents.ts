/** F10 Văn bản quy định: list (Quản trị), add modal with a chosen file, delete confirm, viewer role. */
import type { Browser, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { shot } from "./annotate";
import { DEMO_DOCUMENTS, type DemoDocument, fileBuffer } from "./demo-documents";
import { BASE_URL } from "./guide-config";
import { loggedInPage, openFromMenu, waitForRows } from "./guide-session";

/** Uploads the demo documents through the real API (cookie of the logged-in page). */
export async function seedDemoDocuments(admin: Page): Promise<void> {
  for (const d of DEMO_DOCUMENTS) {
    const res = await admin.context().request.post("/api/documents", {
      headers: { Origin: BASE_URL },
      multipart: {
        doc_number: d.number,
        title: d.title,
        doc_type: d.type,
        issuer: d.issuer,
        issued_date: d.date,
        status: d.status,
        note: d.note,
        file: { name: d.file, mimeType: d.mime, buffer: fileBuffer(d) },
      },
    });
    if (!res.ok())
      throw new Error(`Seeding document ${d.number} failed: ${res.status()} ${await res.text()}`);
  }
}

export async function captureDocuments(page: Page): Promise<void> {
  await page.goto("/");
  await openFromMenu(page, "Văn bản quy định", "Văn bản quy định");
  await waitForRows(page);
  const row = page.getByRole("row", { name: /45\/2026\/TT-BCA/ });
  await shot(page, {
    name: "42-documents-list",
    height: 760,
    callouts: [
      { at: page.getByRole("button", { name: "Thêm văn bản" }), n: 1, pos: "tr" },
      { at: page.locator("#documents-search"), n: 2 },
      { at: page.locator("#documents-type"), n: 3 },
      { at: page.locator("#documents-status"), n: 4 },
      { at: row.locator("td").first(), n: 5, pos: "l", pad: 2 },
      { at: row.getByRole("button", { name: "Tải về 45/2026/TT-BCA" }), n: 6, pos: "tl" },
      { at: row.getByRole("button", { name: "Sửa 45/2026/TT-BCA" }), n: 7, pos: "tl" },
      { at: row.getByRole("button", { name: "Xóa 45/2026/TT-BCA" }), n: 8, pos: "tr" },
    ],
  });
}

export async function captureDocumentForm(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Thêm văn bản" }).click();
  const d = page.getByRole("dialog", { name: "Thêm văn bản" });
  await d.locator("#doc-number").fill("20/2026/TT-BCA");
  await d.locator("#doc-type").selectOption({ label: "Thông tư" });
  await d
    .locator("#doc-title")
    .fill("Thông tư về xếp loại cán bộ và khen thưởng trong lực lượng CSGT (minh họa)");
  await d.locator("#doc-issuer").fill("Bộ Công an");
  await d.locator("#doc-date").fill("2026-10-10");
  await d.locator("#doc-note").fill("Nhập từ bản gốc có dấu");
  const sample = DEMO_DOCUMENTS[1] as DemoDocument;
  await d.locator('input[type="file"]').setInputFiles({
    name: "thong-tu-20-2026.pdf",
    mimeType: sample.mime,
    buffer: fileBuffer(sample),
  });
  await expect(d.getByText(/^Đã chọn: thong-tu-20-2026\.pdf/)).toBeVisible();
  await shot(page, {
    name: "43-document-form",
    height: 900,
    callouts: [
      { at: d.locator("#doc-number"), n: 1 },
      { at: d.locator("#doc-type"), n: 2 },
      { at: d.locator("#doc-title"), n: 3 },
      { at: d.locator("#doc-issuer"), n: 4 },
      { at: d.locator("#doc-date"), n: 5 },
      { at: d.locator("#doc-status"), n: 6 },
      { at: d.locator("#doc-note"), n: 7 },
      { at: d.locator('input[type="file"]'), n: 8 },
      { at: d.getByRole("button", { name: "Lưu" }), n: 9, pos: "tr" },
      { at: d.getByRole("button", { name: "Hủy" }), n: 10, pos: "tl" },
    ],
  });
  await d.getByRole("button", { name: "Hủy" }).click();
  await expect(d).toBeHidden();
}

export async function captureDocumentDelete(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Xóa 15/2022/TT-BCA" }).click();
  const d = page.getByRole("dialog", { name: "Xóa văn bản" });
  await expect(d).toBeVisible();
  await shot(page, {
    name: "44-document-delete-confirm",
    callouts: [
      { at: d.locator(".confirm-text"), n: 1 },
      { at: d.getByRole("button", { name: "Hủy" }), n: 2, pos: "tl" },
      { at: d.getByRole("button", { name: "Xóa", exact: true }), n: 3, pos: "tr" },
    ],
  });
  await d.getByRole("button", { name: "Hủy" }).click();
}

/** Viewer: can search and download, but has no add / edit / delete buttons. */
export async function captureDocumentsViewer(browser: Browser): Promise<void> {
  const page = await loggedInPage(browser, "xem.demo");
  await openFromMenu(page, "Văn bản quy định", "Văn bản quy định");
  await waitForRows(page);
  await expect(page.getByRole("button", { name: "Thêm văn bản" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Xóa / })).toHaveCount(0);
  const row = page.getByRole("row", { name: /45\/2026\/TT-BCA/ });
  await shot(page, {
    name: "45-documents-viewer",
    height: 700,
    callouts: [
      { at: page.locator(".toolbar"), n: 1 },
      { at: page.locator("table.data-sm"), n: 2, pos: "tl" },
      { at: row.getByRole("button", { name: "Tải về 45/2026/TT-BCA" }), n: 3, pos: "tl" },
    ],
  });
  await page.context().close();
}
