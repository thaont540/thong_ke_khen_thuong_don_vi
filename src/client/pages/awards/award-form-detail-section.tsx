import { FormField, fieldA11y } from "../../components/ui/form-field";
import type { AwardSectionProps } from "./award-form-section-props";
import { FIELD_IDS } from "./award-form-values";

/** Group 4: Chi tiết giải thưởng. */
export function AwardFormDetailSection({ values, errors, set }: AwardSectionProps) {
  return (
    <>
      <div className="group-title">Chi tiết giải thưởng</div>
      <FormField
        id={FIELD_IDS.achievement}
        label="Thành tích, nội dung khen thưởng"
        required
        error={errors.achievement}
        className="full"
      >
        <textarea
          rows={4}
          value={values.achievement}
          onChange={(e) => set({ achievement: e.target.value })}
          {...fieldA11y(FIELD_IDS.achievement, errors.achievement)}
        />
      </FormField>
      <FormField id={FIELD_IDS.note} label="Ghi chú" error={errors.note} className="full">
        <input
          type="text"
          value={values.note}
          onChange={(e) => set({ note: e.target.value })}
          {...fieldA11y(FIELD_IDS.note, errors.note)}
        />
      </FormField>
    </>
  );
}
