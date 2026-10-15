import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import type { MasterDataDto } from "../../../shared/schemas/master-data-dto";
import {
  type OfficerInput,
  type OfficerListItem,
  officerInputSchema,
} from "../../../shared/schemas/officer-schemas";
import { FormField, fieldA11y } from "../../components/ui/form-field";
import { ModalDialog } from "../../components/ui/modal-dialog";
import { SelectField } from "../../components/ui/select-field";
import { UnitTeamSelect } from "../../components/unit-team-select";
import { errorMessage, isApiError } from "../../lib/api-error";
import { fieldMessage } from "../../lib/field-message";
import { OfficerFormCareerFields } from "./officer-form-career-fields";
import { useCreateOfficer, useUpdateOfficer } from "./use-officers-queries";

type FormValues = z.input<typeof officerInputSchema>;
type Fields = keyof FormValues;
const FIELD_NAMES: Fields[] = [
  "full_name",
  "birth_year",
  "badge_number",
  "rank_id",
  "position_id",
  "unit_id",
  "team_id",
  "joined_month",
  "rating_id",
];
const FORM_ID = "officer-form";
/** Empty select/number input -> undefined so zod reports "required" instead of NaN. */
const toNumber = (v: unknown) => (v === "" || v == null ? undefined : Number(v));

interface Props {
  /** null = create. */
  officer: (Pick<OfficerListItem, "id" | "code"> & OfficerInput) | null;
  master: MasterDataDto;
  onClose: () => void;
  onSaved: () => void;
}

export function OfficerFormModal({ officer, master, onClose, onSaved }: Props) {
  const create = useCreateOfficer();
  const update = useUpdateOfficer();
  const busy = create.isPending || update.isPending;
  const form = useForm<FormValues, unknown, OfficerInput>({
    resolver: zodResolver(officerInputSchema),
    defaultValues: {
      full_name: officer?.full_name ?? "",
      birth_year: officer?.birth_year,
      badge_number: officer?.badge_number ?? "",
      rank_id: officer?.rank_id,
      position_id: officer?.position_id,
      unit_id: officer?.unit_id,
      team_id: officer?.team_id ?? null,
      joined_month: officer?.joined_month ?? "",
      rating_id: officer?.rating_id ?? null,
    },
  });
  const { errors } = form.formState;
  const [unitId, teamId] = form.watch(["unit_id", "team_id"]);

  const fail = (e: unknown) => {
    const fields = isApiError(e) ? e.fields : undefined;
    let mapped = false;
    for (const name of FIELD_NAMES) {
      const msg = fields?.[name];
      if (msg) {
        form.setError(name, { message: msg });
        mapped = true;
      }
    }
    if (!mapped) form.setError("root.server", { message: errorMessage(e) });
  };

  const submit = form.handleSubmit((body) => {
    const opts = { onSuccess: onSaved, onError: fail };
    if (officer) update.mutate({ id: officer.id, body }, opts);
    else create.mutate(body, opts);
  });

  const nameError = fieldMessage(errors.full_name, "Nhập họ tên");
  const yearError = fieldMessage(errors.birth_year, "Năm sinh từ 1950 đến 2010");
  const badgeError = fieldMessage(errors.badge_number, "Số hiệu gồm đúng 6 chữ số");
  return (
    <ModalDialog
      title={officer ? "Sửa cán bộ" : "Thêm cán bộ"}
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
        <FormField id="of-code" label="Mã cán bộ" hint="Tự sinh, không sửa được">
          <input id="of-code" type="text" readOnly value={officer?.code ?? "Tự sinh khi lưu"} />
        </FormField>
        <FormField id="of-name" label="Họ tên" required error={nameError}>
          <input
            type="text"
            autoComplete="off"
            {...form.register("full_name")}
            {...fieldA11y("of-name", nameError)}
          />
        </FormField>
        <FormField id="of-year" label="Năm sinh" required error={yearError}>
          <input
            type="number"
            inputMode="numeric"
            {...form.register("birth_year", { setValueAs: toNumber })}
            {...fieldA11y("of-year", yearError)}
          />
        </FormField>
        <FormField id="of-badge" label="Số hiệu" required error={badgeError}>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            autoComplete="off"
            {...form.register("badge_number")}
            {...fieldA11y("of-badge", badgeError)}
          />
        </FormField>
        <SelectField
          id="of-rank"
          label="Cấp bậc"
          required
          options={[
            { value: "", label: "Chọn cấp bậc" },
            ...master.ranks.map((r) => ({ value: r.id, label: r.name })),
          ]}
          error={fieldMessage(errors.rank_id, "Chọn cấp bậc")}
          {...form.register("rank_id", { setValueAs: toNumber })}
        />
        <SelectField
          id="of-position"
          label="Chức vụ"
          required
          options={[
            { value: "", label: "Chọn chức vụ" },
            ...master.positions.map((p) => ({ value: p.id, label: p.name })),
          ]}
          error={fieldMessage(errors.position_id, "Chọn chức vụ")}
          {...form.register("position_id", { setValueAs: toNumber })}
        />
        <UnitTeamSelect
          idPrefix="of"
          units={master.units}
          unitId={unitId ?? null}
          teamId={teamId ?? null}
          unitFirstLabel="Chọn đơn vị"
          teamFirstLabel="Không thuộc đội"
          allTeamsWhenNoUnit={false}
          onChange={(v) => {
            form.setValue("unit_id", v.unitId as number, {
              shouldValidate: form.formState.isSubmitted,
            });
            form.setValue("team_id", v.teamId);
          }}
        />
        {errors.unit_id ? (
          <div className="err full" role="alert">
            Chọn đơn vị
          </div>
        ) : null}
        <OfficerFormCareerFields
          register={form.register}
          errors={errors}
          ratings={master.officer_ratings}
        />
      </form>
    </ModalDialog>
  );
}
