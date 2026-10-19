import { describe, expect, it } from "vitest";
import {
  daysInMonth,
  isoToVnText,
  maskVnText,
  parseVnDate,
  parseVnMonth,
  vnToday,
  weekdayIndex,
} from "../../src/client/components/vn-date/vn-date-text";

describe("parseVnDate", () => {
  it("parses dd/mm/yyyy and pads 1-digit day/month", () => {
    expect(parseVnDate("15/09/2026")).toBe("2026-09-15");
    expect(parseVnDate("5/9/2026")).toBe("2026-09-05");
  });
  it("handles leap years", () => {
    expect(parseVnDate("29/02/2024")).toBe("2024-02-29");
    expect(parseVnDate("29/02/2026")).toBeNull();
    expect(parseVnDate("29/02/2100")).toBeNull();
  });
  it("rejects malformed and impossible dates", () => {
    for (const bad of [
      "",
      "31/02/2026",
      "32/01/2026",
      "00/01/2026",
      "15/13/2026",
      "15/09/26",
      "2026-09-15",
      "15/09",
    ]) {
      expect(parseVnDate(bad)).toBeNull();
    }
  });
});

describe("parseVnMonth", () => {
  it("parses mm/yyyy and pads 1-digit month", () => {
    expect(parseVnMonth("09/2026")).toBe("2026-09");
    expect(parseVnMonth("9/2026")).toBe("2026-09");
  });
  it("rejects invalid months", () => {
    for (const bad of ["", "00/2026", "13/2026", "09/26", "2026-09"])
      expect(parseVnMonth(bad)).toBeNull();
  });
});

describe("isoToVnText", () => {
  it("formats ISO and keeps non-ISO text visible", () => {
    expect(isoToVnText("date", "2026-09-15")).toBe("15/09/2026");
    expect(isoToVnText("month", "2026-09")).toBe("09/2026");
    expect(isoToVnText("date", "")).toBe("");
    expect(isoToVnText("date", "15/0")).toBe("15/0");
  });
});

describe("maskVnText", () => {
  it("auto-inserts slashes while typing", () => {
    expect(maskVnText("date", "15")).toBe("15/");
    expect(maskVnText("date", "1509")).toBe("15/09/");
    expect(maskVnText("date", "15092026")).toBe("15/09/2026");
    expect(maskVnText("month", "09")).toBe("09/");
    expect(maskVnText("month", "092026")).toBe("09/2026");
  });
  it("keeps typed slashes, drops junk and extra digits, lets Backspace remove the slash", () => {
    expect(maskVnText("date", "5/")).toBe("5/");
    expect(maskVnText("date", "5/9/2026")).toBe("5/9/2026");
    expect(maskVnText("date", "15//")).toBe("15/");
    expect(maskVnText("date", "ab1c5")).toBe("15/");
    expect(maskVnText("date", "150920261")).toBe("15/09/2026");
    expect(maskVnText("date", "15", false)).toBe("15");
  });
});

describe("calendar helpers", () => {
  it("computes month length and Monday-first weekday", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 9)).toBe(30);
    expect(weekdayIndex(2026, 9, 1)).toBe(1); // Tuesday
    expect(weekdayIndex(2026, 10, 18)).toBe(6); // Sunday
  });
  it("uses Vietnam time for today", () => {
    expect(vnToday(new Date("2026-10-19T18:00:00Z"))).toEqual({ year: 2026, month: 10, day: 20 });
    expect(vnToday(new Date("2026-12-31T20:00:00Z"))).toEqual({ year: 2027, month: 1, day: 1 });
  });
});
