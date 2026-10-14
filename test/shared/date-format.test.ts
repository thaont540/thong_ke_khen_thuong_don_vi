import { describe, expect, it } from "vitest";
import { isoToDisplay, isValidIsoDate, parseDateInput } from "../../src/shared/date-format";

describe("date-format", () => {
  it("parses dd/mm/yyyy and ISO to ISO", () => {
    expect(parseDateInput("15/09/2026")).toBe("2026-09-15");
    expect(parseDateInput("5/9/2026")).toBe("2026-09-05");
    expect(parseDateInput("2026-09-15")).toBe("2026-09-15");
  });

  it("rejects impossible or malformed dates", () => {
    expect(parseDateInput("31/02/2026")).toBeNull();
    expect(parseDateInput("2026-13-01")).toBeNull();
    expect(parseDateInput("29/02/2025")).toBeNull();
    expect(parseDateInput("15-09-2026")).toBeNull();
    expect(parseDateInput("")).toBeNull();
  });

  it("accepts leap day", () => {
    expect(parseDateInput("29/02/2028")).toBe("2028-02-29");
  });

  it("formats ISO as dd/mm/yyyy", () => {
    expect(isoToDisplay("2026-09-15")).toBe("15/09/2026");
    expect(isoToDisplay("garbage")).toBe("garbage");
  });

  it("validates ISO strictly", () => {
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2026-09-15")).toBe(true);
  });
});
