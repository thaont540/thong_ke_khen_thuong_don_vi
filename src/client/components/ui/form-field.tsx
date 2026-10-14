import type { ReactNode } from "react";

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string | undefined;
  hint?: string;
  className?: string;
  children: ReactNode;
}

/** Label + control + inline error. Pair the control with `fieldA11y(id, error)`. */
export function FormField({
  id,
  label,
  required,
  error,
  hint,
  className,
  children,
}: FormFieldProps) {
  const cls = ["field", error ? "invalid" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <label htmlFor={id}>
        {label}
        {required ? <span className="req"> *</span> : null}
      </label>
      {children}
      {hint && !error ? <div className="hint">{hint}</div> : null}
      {error ? (
        <div id={`${id}-error`} className="err" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}

export function fieldA11y(id: string, error?: string) {
  return {
    id,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  };
}
