interface Props<T extends string> {
  name: string;
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}

/** Mockup "seg" radio group (Cá nhân / Tập thể, Danh hiệu / Khen thưởng). */
export function SegmentedField<T extends string>({
  name,
  label,
  value,
  options,
  onChange,
}: Props<T>) {
  return (
    <div className="field">
      <span className="flabel">{label}</span>
      <div className="seg" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <label key={o.value}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
