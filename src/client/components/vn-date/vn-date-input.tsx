import { VnCalendarPopover } from "./vn-calendar-popover";
import { type VnFieldProps, VnPickerField } from "./vn-picker-field";

/** Vietnamese date field: types/shows dd/mm/yyyy, value is ISO `YYYY-MM-DD` ("" when empty). */
export function VnDateInput({ min, max, ...props }: VnFieldProps) {
  return (
    <VnPickerField kind="date" {...props}>
      {({ pick }) => <VnCalendarPopover value={props.value} min={min} max={max} onPick={pick} />}
    </VnPickerField>
  );
}
