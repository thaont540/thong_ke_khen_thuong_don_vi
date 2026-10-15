import { describe, expect, it } from "vitest";
import {
  formatJoinedMonth,
  formatSeniority,
  isJoinedMonthInFuture,
  officerSeniorityYears,
  parseJoinedMonth,
  vnYearMonth,
} from "../../src/shared/officer-seniority";

describe("parseJoinedMonth", () => {
  it("accepts YYYY-MM with month 01-12 only", () => {
    expect(parseJoinedMonth("2015-06")).toEqual({ year: 2015, month: 6 });
    for (const bad of ["2015-00", "2015-13", "2015-6", "15-06", "2015-06-01", "", "abcd-ef"]) {
      expect(parseJoinedMonth(bad)).toBeNull();
    }
  });
});

describe("vnYearMonth (Asia/Ho_Chi_Minh, UTC+7)", () => {
  it("rolls to the next year when UTC is still 31 Dec but Vietnam is 1 Jan", () => {
    expect(vnYearMonth(new Date("2026-12-31T17:00:00Z"))).toEqual({ year: 2027, month: 1 });
  });
  it("stays in the same year just before the VN midnight", () => {
    expect(vnYearMonth(new Date("2026-12-31T16:59:59Z"))).toEqual({ year: 2026, month: 12 });
  });
});

describe("officerSeniorityYears", () => {
  const now = new Date("2026-10-15T03:00:00Z");
  it("is null without a joined month (or a malformed one)", () => {
    expect(officerSeniorityYears(null, now)).toBeNull();
    expect(officerSeniorityYears(undefined, now)).toBeNull();
    expect(officerSeniorityYears("", now)).toBeNull();
    expect(officerSeniorityYears("2020-13", now)).toBeNull();
  });
  it("counts calendar years only, ignoring months", () => {
    expect(officerSeniorityYears("2015-01", now)).toBe(11);
    expect(officerSeniorityYears("2015-12", now)).toBe(11);
    expect(officerSeniorityYears("2026-01", now)).toBe(0);
  });
  it("uses the Vietnam year at the year boundary", () => {
    const boundary = new Date("2026-12-31T18:00:00Z"); // 01/01/2027 in Vietnam
    expect(officerSeniorityYears("2020-05", boundary)).toBe(7);
  });
});

describe("isJoinedMonthInFuture", () => {
  const now = new Date("2026-10-15T03:00:00Z");
  it("compares against the current VN month", () => {
    expect(isJoinedMonthInFuture({ year: 2026, month: 10 }, now)).toBe(false);
    expect(isJoinedMonthInFuture({ year: 2026, month: 11 }, now)).toBe(true);
    expect(isJoinedMonthInFuture({ year: 2027, month: 1 }, now)).toBe(true);
    expect(isJoinedMonthInFuture({ year: 2026, month: 9 }, now)).toBe(false);
  });
});

describe("formatters", () => {
  it("formats seniority and joined month, dash when empty", () => {
    expect(formatSeniority(5)).toBe("5 năm");
    expect(formatSeniority(0)).toBe("0 năm");
    expect(formatSeniority(null)).toBe("—");
    expect(formatJoinedMonth("2015-06")).toBe("06/2015");
    expect(formatJoinedMonth(null)).toBe("—");
    expect(formatJoinedMonth("bad")).toBe("—");
  });
});
