import { type Control, Controller, type FieldErrors } from "react-hook-form";
import type { z } from "zod";
import { vnYearMonth } from "../../../shared/officer-seniority";
import type { officerInputSchema } from "../../../shared/schemas/officer-schemas";
import { FormField, fieldA11y } from "../../components/ui/form-field";
import { toIsoMonth } from "../../components/vn-date/vn-date-text";
import { VnMonthInput } from "../../components/vn-date/vn-month-input";
import { fieldMessage } from "../../lib/field-message";

type FormValues = z.input<typeof officerInputSchema>;

interface Props {
  control: Control<FormValues, unknown, z.output<typeof officerInputSchema>>;
  errors: FieldErrors<FormValues>;
}

/** Optional career field of the officer form: month joined the force (the rating is a yearly award record). */
export function OfficerFormCareerFields({ control, errors }: Props) {
  const joinedError = fieldMessage(errors.joined_month, "Tháng năm vào ngành không hợp lệ");
  const now = vnYearMonth();
  return (
    <FormField id="of-joined" label="Tháng năm vào ngành" error={joinedError}>
      <Controller
        control={control}
        name="joined_month"
        render={({ field }) => (
          <VnMonthInput
            value={field.value ?? ""}
            // Empty month is "not declared" -> null, like the API contract.
            onChange={(v) => field.onChange(v === "" ? null : v)}
            onBlur={field.onBlur}
            max={toIsoMonth(now.year, now.month)}
            {...fieldA11y("of-joined", joinedError)}
          />
        )}
      />
    </FormField>
  );
}
