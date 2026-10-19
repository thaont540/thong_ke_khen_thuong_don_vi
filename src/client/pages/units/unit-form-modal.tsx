import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { UNIT_KINDS } from "../../../shared/domain-enums";
import {
  type UnitDetail,
  type UnitUpsert,
  unitUpsertSchema,
} from "../../../shared/schemas/unit-schemas";
import { EmptyState } from "../../components/ui/empty-state";
import { FormField, fieldA11y } from "../../components/ui/form-field";
import { ModalDialog } from "../../components/ui/modal-dialog";
import { SelectField } from "../../components/ui/select-field";
import { errorMessage, isApiError } from "../../lib/api-error";
import { fieldMessage } from "../../lib/field-message";
import { TeamListEditor, type UnitFormValues } from "./team-list-editor";
import { useCreateUnit, useUnitDetail, useUpdateUnit } from "./use-units-queries";

export const KIND_LABEL: Record<(typeof UNIT_KINDS)[number], string> = {
  CUC: "Cục",
  PHONG: "Phòng",
  THUY_DOAN: "Thủy đoàn",
};
const KIND_OPTIONS = UNIT_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }));
const FORM_ID = "unit-form";

interface Props {
  /** null = create. */
  unitId: number | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Loads the unit (with teams) first when editing, then renders the form. */
export function UnitFormModal({ unitId, onClose, onSaved }: Props) {
  const detail = useUnitDetail(unitId);
  if (unitId === null) return <UnitFormBody unit={null} onClose={onClose} onSaved={onSaved} />;
  if (detail.data) return <UnitFormBody unit={detail.data} onClose={onClose} onSaved={onSaved} />;
  return (
    <ModalDialog title="Sửa đơn vị" onClose={onClose}>
      <EmptyState message={detail.isError ? errorMessage(detail.error) : "Đang tải…"} />
    </ModalDialog>
  );
}

function UnitFormBody({
  unit,
  onClose,
  onSaved,
}: {
  unit: UnitDetail | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const create = useCreateUnit();
  const update = useUpdateUnit();
  const busy = create.isPending || update.isPending;
  const form = useForm<UnitFormValues, unknown, UnitUpsert>({
    resolver: zodResolver(unitUpsertSchema),
    defaultValues: {
      code: unit?.code ?? "",
      kind: unit?.kind ?? "PHONG",
      name: unit?.name ?? "",
      description: unit?.description ?? "",
      teams: unit?.teams.map((t) => ({ id: t.id, name: t.name })) ?? [],
    },
  });
  const teams = useFieldArray({ control: form.control, name: "teams", keyName: "key" });
  const { errors } = form.formState;

  const fail = (e: unknown) => {
    const fields = isApiError(e) ? e.fields : undefined;
    let mapped = false;
    for (const [key, msg] of Object.entries(fields ?? {})) {
      const m = /^teams\.(\d+)$/.exec(key);
      if (m) form.setError(`teams.${m[1]}.name` as `teams.${number}.name`, { message: msg });
      else if (key === "code" || key === "name") form.setError(key, { message: msg });
      else continue;
      mapped = true;
    }
    if (!mapped) form.setError("root.server", { message: errorMessage(e) });
  };

  const submit = form.handleSubmit((body) => {
    const opts = { onSuccess: onSaved, onError: fail };
    if (unit) update.mutate({ id: unit.id, body }, opts);
    else create.mutate(body, opts);
  });

  const codeError = fieldMessage(errors.code, "Nhập mã đơn vị");
  const nameError = fieldMessage(errors.name, "Nhập tên đơn vị");
  return (
    <ModalDialog
      title={unit ? "Sửa đơn vị" : "Thêm đơn vị"}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button type="submit" form={FORM_ID} className="btn btn-primary" disabled={busy}>
            Lưu
          </button>
        </>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={submit} className="form-grid cols-2">
        {errors.root?.server ? (
          <div className="alert-inline full" role="alert">
            {errors.root.server.message}
          </div>
        ) : null}
        <FormField id="unit-code" label="Mã đơn vị" required error={codeError}>
          <input
            type="text"
            autoComplete="off"
            {...form.register("code")}
            {...fieldA11y("unit-code", codeError)}
          />
        </FormField>
        <SelectField
          id="unit-kind"
          label="Loại đơn vị"
          required
          options={KIND_OPTIONS}
          {...form.register("kind")}
        />
        <FormField id="unit-name" label="Tên đơn vị" required error={nameError} className="full">
          <input
            type="text"
            autoComplete="off"
            {...form.register("name")}
            {...fieldA11y("unit-name", nameError)}
          />
        </FormField>
        <FormField
          id="unit-description"
          label="Mô tả"
          error={fieldMessage(errors.description, "Mô tả tối đa 500 ký tự")}
          className="full"
        >
          <textarea rows={2} {...form.register("description")} id="unit-description" />
        </FormField>
        <TeamListEditor
          fields={teams.fields}
          register={form.register}
          errors={errors}
          onAdd={() => teams.append({ name: "" })}
          onRemove={teams.remove}
        />
      </form>
    </ModalDialog>
  );
}
