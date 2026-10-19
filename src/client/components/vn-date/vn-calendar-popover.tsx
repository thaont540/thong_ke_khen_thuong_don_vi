import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { parseDateInput } from "../../../shared/date-format";
import { daysInMonth, toIsoDate, vnToday, WEEKDAYS, weekdayIndex } from "./vn-date-text";
import { VnMonthGrid } from "./vn-month-grid";

interface Props {
  /** Selected ISO date or "" / invalid text. */
  value: string;
  /** Inclusive ISO bounds. */
  min?: string | undefined;
  max?: string | undefined;
  onPick: (iso: string) => void;
}

interface Ymd {
  y: number;
  m: number;
  d: number;
}

const toYmd = (iso: string): Ymd => {
  const [y = 0, m = 0, d = 0] = iso.split("-").map(Number);
  return { y, m, d };
};
const addDays = ({ y, m, d }: Ymd, n: number): Ymd => {
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
};
const addMonths = ({ y, m, d }: Ymd, n: number): Ymd => {
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return { y: ny, m: nm, d: Math.min(d, daysInMonth(ny, nm)) };
};
const iso = (v: Ymd) => toIsoDate(v.y, v.m, v.d);
const KEY_STEP: Record<string, (v: Ymd) => Ymd> = {
  ArrowLeft: (v) => addDays(v, -1),
  ArrowRight: (v) => addDays(v, 1),
  ArrowUp: (v) => addDays(v, -7),
  ArrowDown: (v) => addDays(v, 7),
  PageUp: (v) => addMonths(v, -1),
  PageDown: (v) => addMonths(v, 1),
};

/** Month calendar (week starts Monday) with prev/next, month-year jump, "Hôm nay" and "Xóa". */
export function VnCalendarPopover({ value, min, max, onPick }: Props) {
  const today = vnToday();
  const selected = parseDateInput(value);
  const [focus, setFocus] = useState<Ymd>(
    selected ? toYmd(selected) : { y: today.year, m: today.month, d: today.day },
  );
  const [pickingMonth, setPickingMonth] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const wantFocus = useRef(true);
  const todayIso = toIsoDate(today.year, today.month, today.day);
  const outOfRange = (s: string) =>
    (min !== undefined && s < min) || (max !== undefined && s > max);

  useEffect(() => {
    if (pickingMonth || !wantFocus.current) return;
    wantFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${iso(focus)}"]`)?.focus();
  });

  const shiftMonth = (n: number) => setFocus(addMonths(focus, n));
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = KEY_STEP[e.key];
    if (!step) return;
    e.preventDefault();
    const next = step(focus);
    if (outOfRange(iso(next))) return;
    wantFocus.current = true;
    setFocus(next);
  };

  if (pickingMonth) {
    return (
      <VnMonthGrid
        initialYear={focus.y}
        selectedYear={selected ? toYmd(selected).y : undefined}
        selectedMonth={selected ? toYmd(selected).m : undefined}
        minIndex={min ? toYmd(min).y * 12 + toYmd(min).m : undefined}
        maxIndex={max ? toYmd(max).y * 12 + toYmd(max).m : undefined}
        focusMonth={focus.m}
        onPick={(y, m) => {
          wantFocus.current = true;
          setFocus({ y, m, d: Math.min(focus.d, daysInMonth(y, m)) });
          setPickingMonth(false);
        }}
      />
    );
  }

  const lead = weekdayIndex(focus.y, focus.m, 1);
  const total = daysInMonth(focus.y, focus.m);
  return (
    <div className="vn-days">
      <div className="vn-pop-head">
        <button
          type="button"
          className="vn-nav"
          aria-label="Tháng trước"
          onClick={() => shiftMonth(-1)}
        >
          ‹
        </button>
        <button
          type="button"
          className="vn-pop-title vn-title-btn"
          aria-label="Chọn tháng và năm"
          onClick={() => setPickingMonth(true)}
        >
          Tháng {focus.m}, {focus.y}
        </button>
        <button
          type="button"
          className="vn-nav"
          aria-label="Tháng sau"
          onClick={() => shiftMonth(1)}
        >
          ›
        </button>
      </div>
      <div className="vn-weekdays" aria-hidden="true">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div
        ref={gridRef}
        className="vn-day-grid"
        role="group"
        aria-label={`Tháng ${focus.m} năm ${focus.y}`}
        onKeyDown={onKeyDown}
      >
        {Array.from({ length: lead }, (_, i) => `pad-${i}`).map((k) => (
          <span key={k} />
        ))}
        {Array.from({ length: total }, (_, i) => i + 1).map((d) => {
          const cell = toIsoDate(focus.y, focus.m, d);
          const cls = [
            "vn-cell",
            cell === selected ? "selected" : "",
            cell === todayIso ? "today" : "",
          ];
          return (
            <button
              key={d}
              type="button"
              data-iso={cell}
              className={cls.filter(Boolean).join(" ")}
              tabIndex={d === focus.d ? 0 : -1}
              aria-label={`${d} tháng ${focus.m} năm ${focus.y}`}
              aria-pressed={cell === selected}
              aria-current={cell === todayIso ? "date" : undefined}
              disabled={outOfRange(cell)}
              onClick={() => onPick(cell)}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div className="vn-pop-foot">
        <button
          type="button"
          className="vn-link"
          disabled={outOfRange(todayIso)}
          onClick={() => onPick(todayIso)}
        >
          Hôm nay
        </button>
        <button type="button" className="vn-link" onClick={() => onPick("")}>
          Xóa
        </button>
      </div>
    </div>
  );
}
