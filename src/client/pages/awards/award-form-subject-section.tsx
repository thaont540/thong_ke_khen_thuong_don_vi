import { SelectField } from "../../components/ui/select-field";
import { AwardFormOfficerInfo } from "./award-form-officer-info";
import type { AwardSectionProps } from "./award-form-section-props";
import { SegmentedField } from "./award-form-segmented-field";
import { FIELD_IDS } from "./award-form-values";

/** Group 1: Đối tượng được khen. */
export function AwardFormSubjectSection({ values, errors, dep, master }: AwardSectionProps) {
  const isPersonal = values.subject === "CA_NHAN";
  const noTeams = dep.unit !== null && dep.teams.length === 0;
  return (
    <>
      <div className="group-title">Đối tượng được khen</div>
      <SegmentedField
        name="a-subject"
        label="Đối tượng"
        value={values.subject}
        options={[
          { value: "CA_NHAN", label: "Cá nhân" },
          { value: "TAP_THE", label: "Tập thể" },
        ]}
        onChange={dep.changeSubject}
      />
      <SelectField
        id={FIELD_IDS.unit_id}
        label="Đơn vị"
        required
        error={errors.unit_id}
        value={values.unit_id}
        options={[
          { value: "", label: "Chọn đơn vị" },
          ...master.units.map((u) => ({ value: u.id, label: u.name })),
        ]}
        onChange={(e) => dep.changeUnit(e.target.value)}
      />
      <SelectField
        id={FIELD_IDS.team_id}
        label="Đội"
        disabled={!dep.unit || noTeams}
        title={noTeams ? `${dep.unit?.name} không có đội trực thuộc` : undefined}
        value={values.team_id}
        options={[
          { value: "", label: isPersonal ? "Tất cả đội" : "Khen cho cả đơn vị" },
          ...dep.teams.map((t) => ({ value: t.id, label: t.name })),
        ]}
        onChange={(e) => dep.changeTeam(e.target.value)}
      />
      {isPersonal ? (
        <>
          <SelectField
            id={FIELD_IDS.officer_id}
            label="Cán bộ"
            required
            fieldClassName="span-2"
            disabled={!dep.unit}
            error={errors.officer_id}
            value={values.officer_id}
            options={[
              { value: "", label: dep.unit ? "Chọn cán bộ" : "Chọn đơn vị trước" },
              ...dep.officerChoices.map((o) => ({
                value: o.id,
                label: `${o.full_name} (${master.ranks.find((r) => r.id === o.rank_id)?.name ?? "—"}, ${o.badge_number})`,
              })),
            ]}
            onChange={(e) => dep.setOfficer(e.target.value)}
          />
          <div className="field">
            <span className="flabel">Thông tin cán bộ</span>
            <AwardFormOfficerInfo
              officerId={values.officer_id ? Number(values.officer_id) : null}
              master={master}
            />
          </div>
        </>
      ) : null}
    </>
  );
}
