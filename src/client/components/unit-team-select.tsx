import type { UnitDto } from "../../shared/schemas/master-data-dto";
import { SelectField } from "./ui/select-field";

interface UnitTeamSelectProps {
  units: readonly UnitDto[];
  unitId: number | null;
  teamId: number | null;
  onChange: (value: { unitId: number | null; teamId: number | null }) => void;
  idPrefix: string;
  unitLabel?: string;
  teamLabel?: string;
  /** First option of the unit select (value ""). */
  unitFirstLabel?: string;
  /** First option of the team select (value ""). */
  teamFirstLabel?: string;
  /** Unit "Tất cả" lists every team (filters). When false the team select is locked (forms). */
  allTeamsWhenNoUnit?: boolean;
  disabled?: boolean;
}

const toId = (v: string): number | null => (v === "" ? null : Number(v));

/** Unit + team pair. BR-03: a unit without teams locks the team select at its default. */
export function UnitTeamSelect(p: UnitTeamSelectProps) {
  const {
    units,
    unitId,
    teamId,
    onChange,
    idPrefix,
    unitLabel = "Đơn vị",
    teamLabel = "Đội",
    unitFirstLabel = "Tất cả",
    teamFirstLabel = "Tất cả",
    allTeamsWhenNoUnit = true,
    disabled,
  } = p;

  const unit = units.find((u) => u.id === unitId) ?? null;
  const teams = unit ? unit.teams : allTeamsWhenNoUnit ? units.flatMap((u) => u.teams) : [];
  const noTeams = unit ? unit.teams.length === 0 : !allTeamsWhenNoUnit;
  const effectiveTeamId = teams.some((t) => t.id === teamId) ? teamId : null;

  return (
    <>
      <SelectField
        id={`${idPrefix}-unit`}
        label={unitLabel}
        disabled={disabled}
        value={unit ? unit.id : ""}
        options={[
          { value: "", label: unitFirstLabel },
          ...units.map((u) => ({ value: u.id, label: u.name })),
        ]}
        onChange={(e) => onChange({ unitId: toId(e.target.value), teamId: null })}
      />
      <SelectField
        id={`${idPrefix}-team`}
        label={teamLabel}
        disabled={disabled || noTeams}
        title={unit && noTeams ? `${unit.name} không có đội trực thuộc` : undefined}
        value={effectiveTeamId ?? ""}
        options={[
          { value: "", label: teamFirstLabel },
          ...teams.map((t) => ({ value: t.id, label: t.name })),
        ]}
        onChange={(e) => onChange({ unitId: unit ? unit.id : null, teamId: toId(e.target.value) })}
      />
    </>
  );
}
