import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { VnDateInput } from "../../src/client/components/vn-date/vn-date-input";
import { VnMonthInput } from "../../src/client/components/vn-date/vn-month-input";

function DateHarness({ initial = "", max }: { initial?: string; max?: string }) {
  const [v, setV] = useState(initial);
  return (
    <>
      <label htmlFor="d">Ngày</label>
      <VnDateInput id="d" value={v} onChange={setV} {...(max ? { max } : {})} />
      <output data-testid="value">{v}</output>
    </>
  );
}
function MonthHarness({ initial = "", max }: { initial?: string; max?: string }) {
  const [v, setV] = useState(initial);
  return (
    <>
      <label htmlFor="m">Tháng</label>
      <VnMonthInput id="m" value={v} onChange={setV} {...(max ? { max } : {})} />
      <output data-testid="value">{v}</output>
    </>
  );
}
const value = () => screen.getByTestId("value").textContent;

describe("VnDateInput", () => {
  it("shows the Vietnamese placeholder and formats the ISO value", () => {
    render(<DateHarness initial="2026-09-15" />);
    expect(screen.getByLabelText("Ngày")).toHaveValue("15/09/2026");
    expect(screen.getByLabelText("Ngày")).toHaveAttribute("placeholder", "dd/mm/yyyy");
  });

  it("typing digits auto-inserts slashes and emits ISO", async () => {
    const user = userEvent.setup();
    render(<DateHarness />);
    const input = screen.getByLabelText("Ngày");
    await user.type(input, "15092026");
    expect(input).toHaveValue("15/09/2026");
    expect(value()).toBe("2026-09-15");
  });

  it("pads 1-digit day/month on blur", async () => {
    const user = userEvent.setup();
    render(<DateHarness />);
    const input = screen.getByLabelText("Ngày");
    await user.type(input, "5/9/2026");
    expect(value()).toBe("2026-09-05");
    await user.tab();
    expect(input).toHaveValue("05/09/2026");
  });

  it("emits the raw text for invalid dates so form validation can flag it, and '' when cleared", async () => {
    const user = userEvent.setup();
    render(<DateHarness />);
    const input = screen.getByLabelText("Ngày");
    await user.type(input, "31022026");
    expect(input).toHaveValue("31/02/2026");
    expect(value()).toBe("31/02/2026");
    await user.clear(input);
    expect(value()).toBe("");
  });

  it("lets Backspace remove an auto-inserted slash", async () => {
    const user = userEvent.setup();
    render(<DateHarness />);
    const input = screen.getByLabelText("Ngày");
    await user.type(input, "15");
    expect(input).toHaveValue("15/");
    await user.type(input, "{Backspace}{Backspace}");
    expect(input).toHaveValue("1");
  });

  it("calendar: Vietnamese labels, Monday-first weekdays, selecting a day", async () => {
    const user = userEvent.setup();
    render(<DateHarness initial="2026-09-15" />);
    await user.click(screen.getByRole("button", { name: "Chọn ngày" }));
    const pop = within(screen.getByRole("dialog", { name: "Chọn ngày" }));
    expect(pop.getByText("Tháng 9, 2026")).toBeInTheDocument();
    expect(document.querySelector(".vn-weekdays")?.textContent).toBe("T2T3T4T5T6T7CN");
    expect(pop.getByRole("button", { name: "Hôm nay" })).toBeInTheDocument();
    expect(pop.getByRole("button", { name: "Xóa" })).toBeInTheDocument();
    expect(pop.getByRole("button", { name: "15 tháng 9 năm 2026" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(pop.getByRole("button", { name: "Tháng sau" }));
    expect(pop.getByText("Tháng 10, 2026")).toBeInTheDocument();
    await user.click(pop.getByRole("button", { name: "20 tháng 10 năm 2026" }));
    expect(value()).toBe("2026-10-20");
    expect(screen.queryByRole("dialog", { name: "Chọn ngày" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Ngày")).toHaveFocus();
  });

  it("calendar: keyboard arrows move the day, Enter selects, Esc closes and returns focus", async () => {
    const user = userEvent.setup();
    render(<DateHarness initial="2026-09-15" />);
    await user.click(screen.getByRole("button", { name: "Chọn ngày" }));
    expect(screen.getByRole("button", { name: "15 tháng 9 năm 2026" })).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowDown}");
    expect(screen.getByRole("button", { name: "23 tháng 9 năm 2026" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(value()).toBe("2026-09-23");

    await user.click(screen.getByRole("button", { name: "Chọn ngày" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Chọn ngày" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Ngày")).toHaveFocus();
  });

  it("calendar: month/year jump, Hôm nay, Xóa, and click outside closes", async () => {
    const user = userEvent.setup();
    render(<DateHarness initial="2026-09-15" />);
    await user.click(screen.getByRole("button", { name: "Chọn ngày" }));
    await user.click(screen.getByRole("button", { name: "Chọn tháng và năm" }));
    await user.click(screen.getByRole("button", { name: "Năm sau" }));
    await user.click(screen.getByRole("button", { name: "Tháng 2 năm 2027" }));
    expect(screen.getByText("Tháng 2, 2027")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hôm nay" }));
    expect(value()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await user.click(screen.getByRole("button", { name: "Chọn ngày" }));
    await user.click(screen.getByRole("button", { name: "Xóa" }));
    expect(value()).toBe("");
    expect(screen.getByLabelText("Ngày")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Chọn ngày" }));
    await user.click(document.body);
    expect(screen.queryByRole("dialog", { name: "Chọn ngày" })).not.toBeInTheDocument();
  });

  it("calendar: days after max are disabled", async () => {
    const user = userEvent.setup();
    render(<DateHarness initial="2026-09-15" max="2026-09-20" />);
    await user.click(screen.getByRole("button", { name: "Chọn ngày" }));
    expect(screen.getByRole("button", { name: "20 tháng 9 năm 2026" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "21 tháng 9 năm 2026" })).toBeDisabled();
  });
});

describe("VnMonthInput", () => {
  it("types mm/yyyy and emits YYYY-MM", async () => {
    const user = userEvent.setup();
    render(<MonthHarness />);
    const input = screen.getByLabelText("Tháng");
    expect(input).toHaveAttribute("placeholder", "mm/yyyy");
    await user.type(input, "092026");
    expect(input).toHaveValue("09/2026");
    expect(value()).toBe("2026-09");
  });

  it("pads a 1-digit month on blur and emits raw text when invalid", async () => {
    const user = userEvent.setup();
    render(<MonthHarness />);
    const input = screen.getByLabelText("Tháng");
    await user.type(input, "9/2026");
    await user.tab();
    expect(input).toHaveValue("09/2026");
    await user.clear(input);
    await user.type(input, "132026");
    expect(value()).toBe("13/2026");
  });

  it("popover: Vietnamese month grid, selecting a month, year navigation", async () => {
    const user = userEvent.setup();
    render(<MonthHarness initial="2026-03" />);
    await user.click(screen.getByRole("button", { name: "Chọn tháng" }));
    const pop = within(screen.getByRole("dialog", { name: "Chọn tháng năm" }));
    expect(pop.getByText("Năm 2026")).toBeInTheDocument();
    expect(pop.getByText("Th12")).toBeInTheDocument();
    expect(pop.getByRole("button", { name: "Tháng 3 năm 2026" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(pop.getByRole("button", { name: "Năm trước" }));
    await user.click(pop.getByRole("button", { name: "Tháng 11 năm 2025" }));
    expect(value()).toBe("2025-11");
    expect(screen.getByLabelText("Tháng")).toHaveValue("11/2025");
  });

  it("popover: months after max are disabled and keyboard works", async () => {
    const user = userEvent.setup();
    render(<MonthHarness initial="2026-03" max="2026-10" />);
    await user.click(screen.getByRole("button", { name: "Chọn tháng" }));
    expect(screen.getByRole("button", { name: "Tháng 10 năm 2026" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Tháng 11 năm 2026" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Năm sau" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Tháng 3 năm 2026" })).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowDown}{Enter}");
    expect(value()).toBe("2026-07");
    await user.click(screen.getByRole("button", { name: "Chọn tháng" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
