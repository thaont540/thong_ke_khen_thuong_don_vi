import type { ComponentProps } from "react";
import { FormField, fieldA11y } from "./form-field";

export interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectFieldProps extends Omit<ComponentProps<"select">, "id"> {
  id: string;
  label: string;
  options: readonly SelectOption[];
  required?: boolean;
  error?: string | undefined;
  hint?: string;
  fieldClassName?: string;
}

export function SelectField({
  id,
  label,
  options,
  required,
  error,
  hint,
  fieldClassName,
  ...selectProps
}: SelectFieldProps) {
  return (
    <FormField
      id={id}
      label={label}
      required={required}
      error={error}
      hint={hint}
      className={fieldClassName}
    >
      <select {...selectProps} {...fieldA11y(id, error)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}
