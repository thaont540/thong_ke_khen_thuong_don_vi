import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { z } from "zod";
import type { OfficerRatingDto } from "../../../shared/schemas/master-data-dto";
import type { officerInputSchema } from "../../../shared/schemas/officer-schemas";
import { FormField, fieldA11y } from "../../components/ui/form-field";
import { SelectField } from "../../components/ui/select-field";
import { fieldMessage } from "../../lib/field-message";

type FormValues = z.input<typeof officerInputSchema>;

/** Empty select -> null (no rating). */
const toNullableNumber = (v: unknown) => (v === "" || v == null ? null : Number(v));
/** Empty month input -> null (not declared). */
const toNullableMonth = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);

interface Props {
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<FormValues>;
  ratings: readonly OfficerRatingDto[];
}

/** Optional career fields of the officer form: month joined the force + current rating. */
export function OfficerFormCareerFields({ register, errors, ratings }: Props) {
  const joinedError = fieldMessage(errors.joined_month, "Tháng năm vào ngành không hợp lệ");
  return (
    <>
      <FormField id="of-joined" label="Tháng năm vào ngành" error={joinedError}>
        <input
          type="month"
          {...register("joined_month", { setValueAs: toNullableMonth })}
          {...fieldA11y("of-joined", joinedError)}
        />
      </FormField>
      <SelectField
        id="of-rating"
        label="Xếp loại"
        options={[
          { value: "", label: "Chưa xếp loại" },
          ...ratings.map((r) => ({ value: r.id, label: r.name })),
        ]}
        error={fieldMessage(errors.rating_id, "Xếp loại không hợp lệ")}
        {...register("rating_id", { setValueAs: toNullableNumber })}
      />
    </>
  );
}
