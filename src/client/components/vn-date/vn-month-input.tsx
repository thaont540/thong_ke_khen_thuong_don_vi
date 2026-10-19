import { parseJoinedMonth } from "../../../shared/officer-seniority";
import { toIsoMonth, vnToday } from "./vn-date-text";
import { VnMonthGrid } from "./vn-month-grid";
import { type VnFieldProps, VnPickerField } from "./vn-picker-field";

const index = (iso: string | undefined) => {
  const ym = iso ? parseJoinedMonth(iso) : null;
  return ym ? ym.year * 12 + ym.month : undefined;
};

/** Vietnamese month field: types/shows mm/yyyy, value is ISO `YYYY-MM` ("" when empty). */
export function VnMonthInput({ min, max, ...props }: VnFieldProps) {
  return (
    <VnPickerField kind="month" {...props}>
      {({ pick }) => {
        const today = vnToday();
        const selected = parseJoinedMonth(props.value);
        const maxIndex = index(max);
        return (
          <>
            <VnMonthGrid
              initialYear={selected?.year ?? today.year}
              selectedYear={selected?.year}
              selectedMonth={selected?.month}
              minIndex={index(min)}
              maxIndex={maxIndex}
              focusMonth={selected?.month ?? today.month}
              onPick={(y, m) => pick(toIsoMonth(y, m))}
            />
            <div className="vn-pop-foot">
              <button type="button" className="vn-link" onClick={() => pick("")}>
                Xóa
              </button>
            </div>
          </>
        );
      }}
    </VnPickerField>
  );
}
