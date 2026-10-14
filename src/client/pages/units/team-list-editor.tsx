import type { FieldErrors, UseFieldArrayReturn, UseFormRegister } from "react-hook-form";
import type { z } from "zod";
import type { unitUpsertSchema } from "../../../shared/schemas/unit-schemas";
import { fieldMessage } from "../../lib/field-message";

export type UnitFormValues = z.input<typeof unitUpsertSchema>;

interface Props {
  fields: UseFieldArrayReturn<UnitFormValues, "teams", "key">["fields"];
  register: UseFormRegister<UnitFormValues>;
  errors: FieldErrors<UnitFormValues>;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

/** Inline team list: add row, rename, remove. Existing rows keep their `id` (hidden field) so rename keeps the code. */
export function TeamListEditor({ fields, register, errors, onAdd, onRemove }: Props) {
  return (
    <fieldset className="field full">
      <legend>Đội trực thuộc</legend>
      {fields.length === 0 ? <div className="hint">Đơn vị chưa có đội trực thuộc.</div> : null}
      {fields.map((f, i) => {
        const err = fieldMessage(errors.teams?.[i]?.name, "Nhập tên đội");
        return (
          <div key={f.key} className={err ? "field invalid" : "field"}>
            <div className="team-row">
              <input
                type="text"
                aria-label={`Tên đội ${i + 1}`}
                aria-invalid={err ? true : undefined}
                autoComplete="off"
                {...register(`teams.${i}.name`)}
              />
              <button
                type="button"
                className="btn btn-sm btn-danger"
                aria-label={`Xóa đội ${i + 1}`}
                onClick={() => onRemove(i)}
              >
                Xóa
              </button>
            </div>
            {err ? (
              <div className="err" role="alert">
                {err}
              </div>
            ) : null}
          </div>
        );
      })}
      <button type="button" className="btn btn-sm" onClick={onAdd}>
        Thêm đội
      </button>
    </fieldset>
  );
}
