import { useState } from "react";
import { useNavigate } from "react-router";
import type { AwardRecord } from "../../../shared/schemas/award-schemas";
import type { MasterDataDto } from "../../../shared/schemas/master-data-dto";
import type { OfficerOption } from "../../../shared/schemas/officer-schemas";
import { awardSubjectName, awardTitle } from "./award-display-text";
import { AwardFormDecisionSection } from "./award-form-decision-section";
import { AwardFormDetailSection } from "./award-form-detail-section";
import { AwardFormSubjectSection } from "./award-form-subject-section";
import { AwardFormTypeSection } from "./award-form-type-section";
import {
  type AwardFormErrors,
  type AwardFormValues,
  emptyAwardForm,
  FIELD_IDS,
} from "./award-form-values";
import { DuplicateWarningDialog } from "./duplicate-warning-dialog";
import { useAwardFormDependentFields } from "./use-award-form-dependent-fields";
import { type AfterSave, useAwardFormSave } from "./use-award-form-save";

interface Props {
  /** Present in edit mode (F09). */
  editing: AwardRecord | null;
  initial: AwardFormValues;
  master: MasterDataDto;
  officers: readonly OfficerOption[];
  /** `?...` filters of F01 to return to after save / cancel in edit mode. */
  backSearch: string;
}

/** F03 (add) / F09 (edit) form body: 4 groups + action buttons. */
export function AwardFormScreen({ editing, initial, master, officers, backSearch }: Props) {
  const navigate = useNavigate();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<AwardFormErrors>({});

  const set = (patch: Partial<AwardFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch) as (keyof AwardFormValues)[]) delete next[k];
      return next;
    });
  };
  const dep = useAwardFormDependentFields(values, set, master, officers);

  const who =
    values.subject === "CA_NHAN"
      ? (dep.selectedOfficer?.full_name ?? "")
      : (dep.teams.find((t) => t.id === Number(values.team_id))?.name ?? dep.unit?.name ?? "");

  const onSaved = (after: AfterSave) => {
    if (editing) return navigate(`/${backSearch}`);
    if (after === "list") return navigate("/");
    // "Lưu và thêm tiếp": keep everything except the officer.
    set({ officer_id: "" });
    document.getElementById(FIELD_IDS.officer_id)?.focus();
  };
  const saver = useAwardFormSave({
    editId: editing?.id ?? null,
    updatedAt: editing?.updated_at,
    values,
    needsVariant: dep.needsVariant,
    who,
    setErrors,
    onSaved,
  });

  const section = { values, errors, set, dep, master };
  return (
    <>
      {editing ? (
        <p className="person-card" role="status">
          Đang sửa bản ghi {editing.decision_number}: {awardTitle(editing)} năm {editing.year} của{" "}
          {awardSubjectName(editing)}
        </p>
      ) : null}
      <form
        className="card"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void saver.save("list");
        }}
      >
        {saver.formError ? (
          <div className="alert-inline" role="alert">
            {saver.formError}
          </div>
        ) : null}
        <div className="form-grid">
          <AwardFormSubjectSection {...section} />
          <AwardFormTypeSection {...section} />
          <AwardFormDecisionSection {...section} />
          <AwardFormDetailSection {...section} />
        </div>
        <div className="form-actions">
          {editing ? (
            <button
              type="button"
              className="btn"
              disabled={saver.pending}
              onClick={() => navigate(`/${backSearch}`)}
            >
              Hủy
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              disabled={saver.pending}
              onClick={() => {
                setValues(emptyAwardForm());
                setErrors({});
              }}
            >
              Xóa nội dung
            </button>
          )}
          <span className="spacer" />
          {editing ? null : (
            <button
              type="button"
              className="btn"
              disabled={saver.pending}
              onClick={() => void saver.save("more")}
            >
              Lưu và thêm tiếp
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={saver.pending}>
            {editing ? "Lưu thay đổi" : "Lưu khen thưởng"}
          </button>
        </div>
      </form>
      {saver.dup ? (
        <DuplicateWarningDialog
          who={who}
          duplicates={saver.dup.duplicates}
          busy={saver.pending}
          onConfirm={() => void saver.save(saver.dup?.after ?? "list", true)}
          onCancel={saver.cancelDuplicate}
        />
      ) : null}
    </>
  );
}
