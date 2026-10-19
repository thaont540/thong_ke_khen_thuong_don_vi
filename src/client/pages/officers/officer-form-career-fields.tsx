import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { z } from "zod";
import type { officerInputSchema } from "../../../shared/schemas/officer-schemas";
import { FormField, fieldA11y } from "../../components/ui/form-field";
import { fieldMessage } from "../../lib/field-message";

type FormValues = z.input<typeof officerInputSchema>;

/** Empty month input -> null (not declared). */
const toNullableMonth = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);

interface Props {
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<FormValues>;
}

/** Optional career field of the officer form: month joined the force (the rating is a yearly award record). */
export function OfficerFormCareerFields({ register, errors }: Props) {
  const joinedError = fieldMessage(errors.joined_month, "Tháng năm vào ngành không hợp lệ");
  return (
    <FormField id="of-joined" label="Tháng năm vào ngành" error={joinedError}>
      <input
        type="month"
        {...register("joined_month", { setValueAs: toNullableMonth })}
        {...fieldA11y("of-joined", joinedError)}
      />
    </FormField>
  );
}
