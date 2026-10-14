import { FormField, fieldA11y } from "../../components/ui/form-field";
import { SelectField } from "../../components/ui/select-field";
import type { AwardSectionProps } from "./award-form-section-props";
import { FIELD_IDS } from "./award-form-values";

/** Group 3: Quyết định khen thưởng. */
export function AwardFormDecisionSection({ values, errors, set, master }: AwardSectionProps) {
  return (
    <>
      <div className="group-title">Quyết định khen thưởng</div>
      <FormField id={FIELD_IDS.year} label="Năm khen thưởng" required error={errors.year}>
        <input
          type="number"
          min={1990}
          max={2100}
          value={values.year}
          onChange={(e) => set({ year: e.target.value })}
          {...fieldA11y(FIELD_IDS.year, errors.year)}
        />
      </FormField>
      <FormField
        id={FIELD_IDS.decision_number}
        label="Số quyết định"
        required
        error={errors.decision_number}
      >
        <input
          type="text"
          maxLength={60}
          placeholder="Ví dụ: 125/QĐ-BCA"
          value={values.decision_number}
          onChange={(e) => set({ decision_number: e.target.value })}
          {...fieldA11y(FIELD_IDS.decision_number, errors.decision_number)}
        />
      </FormField>
      <FormField
        id={FIELD_IDS.decision_date}
        label="Ngày quyết định"
        required
        error={errors.decision_date}
      >
        <input
          type="date"
          value={values.decision_date}
          onChange={(e) => set({ decision_date: e.target.value })}
          {...fieldA11y(FIELD_IDS.decision_date, errors.decision_date)}
        />
      </FormField>
      <SelectField
        id={FIELD_IDS.authority_id}
        label="Cấp quyết định"
        required
        error={errors.authority_id}
        hint="Tự điền theo loại khen thưởng, có thể sửa"
        value={values.authority_id}
        options={[
          { value: "", label: "Chọn cấp quyết định" },
          ...master.authorities.map((a) => ({ value: a.id, label: a.name })),
        ]}
        onChange={(e) => set({ authority_id: e.target.value })}
      />
    </>
  );
}
