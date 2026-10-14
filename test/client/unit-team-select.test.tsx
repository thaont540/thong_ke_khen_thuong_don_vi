import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { UnitTeamSelect } from "../../src/client/components/unit-team-select";
import type { UnitDto } from "../../src/shared/schemas/master-data-dto";

const unit = (id: number, name: string, teams: string[]): UnitDto => ({
  id,
  code: `U${id}`,
  name,
  kind: "PHONG",
  description: null,
  sort_order: id,
  teams: teams.map((t, i) => ({
    id: id * 100 + i,
    unit_id: id,
    code: `T${id}${i}`,
    name: t,
    sort_order: i,
  })),
});

const UNITS = [
  unit(1, "Phòng A", ["Đội 1", "Đội 2"]),
  unit(2, "Phòng B", []),
  unit(3, "Phòng C", ["Đội 3"]),
];

function Harness({ allTeamsWhenNoUnit = true }: { allTeamsWhenNoUnit?: boolean }) {
  const [v, setV] = useState<{ unitId: number | null; teamId: number | null }>({
    unitId: null,
    teamId: null,
  });
  return (
    <UnitTeamSelect
      units={UNITS}
      idPrefix="t"
      unitId={v.unitId}
      teamId={v.teamId}
      onChange={setV}
      teamFirstLabel="Tất cả đội"
      allTeamsWhenNoUnit={allTeamsWhenNoUnit}
    />
  );
}

const teamOptions = () =>
  screen
    .getAllByRole("option")
    .filter((o) => o.closest("select")?.id === "t-team")
    .map((o) => o.textContent);

describe("UnitTeamSelect", () => {
  it("lists every team when no unit is selected (filters)", () => {
    render(<Harness />);
    expect(teamOptions()).toEqual(["Tất cả đội", "Đội 1", "Đội 2", "Đội 3"]);
    expect(screen.getByLabelText("Đội")).toBeEnabled();
  });

  it("locks the team select at the default for a unit without teams (BR-03)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.selectOptions(screen.getByLabelText("Đơn vị"), "Phòng B");
    expect(screen.getByLabelText("Đội")).toBeDisabled();
    expect(screen.getByLabelText("Đội")).toHaveValue("");
  });

  it("narrows teams to the selected unit and resets a stale team on unit change", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.selectOptions(screen.getByLabelText("Đơn vị"), "Phòng A");
    expect(teamOptions()).toEqual(["Tất cả đội", "Đội 1", "Đội 2"]);
    await user.selectOptions(screen.getByLabelText("Đội"), "Đội 2");
    await user.selectOptions(screen.getByLabelText("Đơn vị"), "Phòng C");
    expect(teamOptions()).toEqual(["Tất cả đội", "Đội 3"]);
    expect(screen.getByLabelText("Đội")).toHaveValue("");
  });

  it("locks the team select in forms until a unit is chosen", () => {
    render(<Harness allTeamsWhenNoUnit={false} />);
    expect(screen.getByLabelText("Đội")).toBeDisabled();
  });
});
