import { describe, expect, it } from "vitest";
import { collapseSpaces, normalizeText } from "../../src/shared/normalize-text";

describe("normalizeText (BR-07)", () => {
  it("is case-insensitive including Vietnamese capitals", () => {
    expect(normalizeText("QUYẾT ĐỊNH")).toBe("quyết định");
    expect(normalizeText("QĐ")).toBe(normalizeText("qđ"));
  });

  it("collapses and trims whitespace", () => {
    expect(normalizeText("  Phòng \t  6\n ")).toBe("phòng 6");
  });

  it("treats NFD input equal to NFC", () => {
    const nfd = "Đội Dẫn đoàn".normalize("NFD");
    expect(nfd).not.toBe("Đội Dẫn đoàn");
    expect(normalizeText(nfd)).toBe(normalizeText("Đội Dẫn đoàn"));
  });

  it("collapseSpaces keeps casing", () => {
    expect(collapseSpaces("  Nguyễn   Văn  A ")).toBe("Nguyễn Văn A");
  });
});
