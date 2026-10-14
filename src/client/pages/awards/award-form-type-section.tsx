import { SelectField } from "../../components/ui/select-field";
import type { AwardSectionProps } from "./award-form-section-props";
import { SegmentedField } from "./award-form-segmented-field";
import { FIELD_IDS } from "./award-form-values";

/** Group 2: Danh hiệu, khen thưởng (+ loại huân chương only for Huân chương). */
export function AwardFormTypeSection({ values, errors, dep }: AwardSectionProps) {
  const isTitle = values.form === "DANH_HIEU";
  return (
    <>
      <div className="group-title">Danh hiệu, khen thưởng</div>
      <SegmentedField
        name="a-form"
        label="Hình thức"
        value={values.form}
        options={[
          { value: "DANH_HIEU", label: "Danh hiệu" },
          { value: "KHEN_THUONG", label: "Khen thưởng" },
        ]}
        onChange={dep.changeForm}
      />
      <SelectField
        id={FIELD_IDS.award_type_id}
        label={isTitle ? "Danh hiệu thi đua" : "Hình thức khen thưởng"}
        required
        error={errors.award_type_id}
        value={values.award_type_id}
        options={[
          { value: "", label: isTitle ? "Chọn danh hiệu" : "Chọn hình thức khen thưởng" },
          ...dep.typeOptions.map((t) => ({ value: t.id, label: t.name })),
        ]}
        onChange={(e) => dep.changeType(e.target.value)}
      />
      {dep.needsVariant ? (
        <SelectField
          id={FIELD_IDS.award_variant_id}
          label="Loại huân chương"
          required
          error={errors.award_variant_id}
          value={values.award_variant_id}
          options={[
            { value: "", label: "Chọn loại huân chương" },
            ...dep.variantOptions.map((v) => ({ value: v.id, label: v.name })),
          ]}
          onChange={(e) => dep.set({ award_variant_id: e.target.value })}
        />
      ) : null}
    </>
  );
}
