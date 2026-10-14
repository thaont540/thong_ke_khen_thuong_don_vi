import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ModalDialog } from "../../src/client/components/ui/modal-dialog";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Mở
      </button>
      {open ? (
        <ModalDialog
          title="Hộp thoại"
          onClose={() => setOpen(false)}
          footer={
            <button type="button" onClick={() => setOpen(false)}>
              Đóng
            </button>
          }
        >
          <input aria-label="Ô nhập" />
        </ModalDialog>
      ) : null}
    </>
  );
}

const open = async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole("button", { name: "Mở" }));
  expect(screen.getByRole("dialog", { name: "Hộp thoại" })).toHaveAttribute("aria-modal", "true");
  return user;
};

describe("ModalDialog", () => {
  it("focuses the first field and closes on Esc, restoring focus", async () => {
    const user = await open();
    expect(screen.getByLabelText("Ô nhập")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mở" })).toHaveFocus();
  });

  it("closes on backdrop click but not on dialog body click", async () => {
    const user = await open();
    await user.click(screen.getByLabelText("Ô nhập"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByTestId("dialog-backdrop"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes with the × button", async () => {
    const user = await open();
    await user.click(screen.getAllByRole("button", { name: "Đóng" })[0] as HTMLElement);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes with the footer Đóng button", async () => {
    const user = await open();
    const buttons = screen.getAllByRole("button", { name: "Đóng" });
    await user.click(buttons[buttons.length - 1] as HTMLElement);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("traps Tab inside the dialog", async () => {
    const user = await open();
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
  });
});
