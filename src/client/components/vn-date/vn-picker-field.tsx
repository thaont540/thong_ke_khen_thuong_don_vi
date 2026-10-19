import {
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { isoToVnText, maskVnText, parseVnText, type VnKind } from "./vn-date-text";

/** Props shared by VnDateInput / VnMonthInput. `value` and `onChange` use ISO (`YYYY-MM-DD` / `YYYY-MM`) or "". */
export interface VnFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  "aria-invalid"?: boolean | undefined;
  "aria-describedby"?: string | undefined;
  /** Inclusive ISO bounds for the popover only; typed values are validated by the form. */
  min?: string;
  max?: string;
}

interface Props extends VnFieldProps {
  kind: VnKind;
  children: (api: { pick: (iso: string) => void }) => ReactNode;
}

const COPY = {
  date: { placeholder: "dd/mm/yyyy", button: "Chọn ngày", popup: "Chọn ngày" },
  month: { placeholder: "mm/yyyy", button: "Chọn tháng", popup: "Chọn tháng năm" },
} as const;

/**
 * Value an edited text maps to: "" when empty, ISO when it parses, otherwise the raw text
 * (so the caller's own validation reports "không hợp lệ" instead of silently dropping input).
 */
const emitted = (kind: VnKind, text: string) =>
  text === "" ? "" : (parseVnText(kind, text) ?? text);

/** Vietnamese text input (dd/mm/yyyy or mm/yyyy) with a calendar popover supplied via `children`. */
export function VnPickerField({
  kind,
  id,
  value,
  onChange,
  onBlur,
  disabled,
  children,
  "aria-invalid": ariaInvalid,
  "aria-describedby": describedBy,
}: Props) {
  const copy = COPY[kind];
  const [text, setText] = useState(() => isoToVnText(kind, value));
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // External value changes (form reset, API errors, calendar pick) replace the text.
  useEffect(() => {
    if (emitted(kind, text) !== value) setText(isoToVnText(kind, value));
  }, [kind, value, text]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const close = () => {
    setOpen(false);
    inputRef.current?.focus();
  };
  const pick = (iso: string) => {
    onChange(iso);
    setText(isoToVnText(kind, iso));
    close();
  };

  const edit = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const next = maskVnText(kind, raw, raw.length > text.length);
    setText(next);
    onChange(emitted(kind, next));
  };
  const blur = () => {
    const iso = parseVnText(kind, text);
    if (iso) setText(isoToVnText(kind, iso));
    onBlur?.();
  };
  const keyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && open) {
      e.stopPropagation(); // keep the surrounding modal open
      close();
    } else if (e.key === "ArrowDown" && e.altKey && !open) {
      e.preventDefault();
      setOpen(true);
    }
  };
  const focusOut = (e: FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (open && next && !rootRef.current?.contains(next)) setOpen(false);
  };

  return (
    <div ref={rootRef} className="vn-picker" onKeyDown={keyDown} onBlur={focusOut}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        placeholder={copy.placeholder}
        value={text}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        aria-describedby={describedBy}
        onChange={edit}
        onBlur={blur}
      />
      <button
        type="button"
        className="vn-picker-btn"
        aria-label={copy.button}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
      </button>
      {open ? (
        <div
          className="vn-popover"
          role="dialog"
          aria-label={copy.popup}
          onMouseDown={(e) => e.preventDefault()}
        >
          {children({ pick })}
        </div>
      ) : null}
    </div>
  );
}
