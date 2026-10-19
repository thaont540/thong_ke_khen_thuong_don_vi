import { type KeyboardEvent, useEffect, useRef, useState } from "react";

interface Props {
  /** Year shown first. */
  initialYear: number;
  /** Selected month (1-12) within `selectedYear`, if any. */
  selectedYear?: number | undefined;
  selectedMonth?: number | undefined;
  /** Inclusive bounds as `year * 12 + month`; undefined = unbounded. */
  minIndex?: number | undefined;
  maxIndex?: number | undefined;
  /** Month to focus when the grid mounts. */
  focusMonth: number;
  onPick: (year: number, month: number) => void;
}

const COLUMNS = 3;

/** Year header (prev/next) + 3x4 grid of "Th1" ... "Th12". Used by the month input and the calendar's month jump. */
export function VnMonthGrid({
  initialYear,
  selectedYear,
  selectedMonth,
  minIndex,
  maxIndex,
  focusMonth,
  onPick,
}: Props) {
  const [year, setYear] = useState(initialYear);
  const gridRef = useRef<HTMLDivElement>(null);
  const disabled = (m: number) => {
    const idx = year * 12 + m;
    return (minIndex !== undefined && idx < minIndex) || (maxIndex !== undefined && idx > maxIndex);
  };
  const prevBlocked = minIndex !== undefined && (year - 1) * 12 + 12 < minIndex;
  const nextBlocked = maxIndex !== undefined && (year + 1) * 12 + 1 > maxIndex;

  useEffect(() => {
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-month="${focusMonth}"]`)?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLUMNS, ArrowDown: COLUMNS }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const current = Number((document.activeElement as HTMLElement | null)?.dataset.month ?? 0);
    const next = gridRef.current?.querySelector<HTMLButtonElement>(
      `[data-month="${current + step}"]`,
    );
    if (next && !next.disabled) next.focus();
  };

  return (
    <div className="vn-months">
      <div className="vn-pop-head">
        <button
          type="button"
          className="vn-nav"
          aria-label="Năm trước"
          disabled={prevBlocked}
          onClick={() => setYear(year - 1)}
        >
          ‹
        </button>
        <span className="vn-pop-title" aria-live="polite">
          Năm {year}
        </span>
        <button
          type="button"
          className="vn-nav"
          aria-label="Năm sau"
          disabled={nextBlocked}
          onClick={() => setYear(year + 1)}
        >
          ›
        </button>
      </div>
      <div
        ref={gridRef}
        className="vn-month-grid"
        role="group"
        aria-label="Chọn tháng"
        onKeyDown={onKeyDown}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
          const selected = year === selectedYear && m === selectedMonth;
          return (
            <button
              key={m}
              type="button"
              data-month={m}
              className={selected ? "vn-cell selected" : "vn-cell"}
              aria-label={`Tháng ${m} năm ${year}`}
              aria-pressed={selected}
              disabled={disabled(m)}
              onClick={() => onPick(year, m)}
            >
              Th{m}
            </button>
          );
        })}
      </div>
    </div>
  );
}
