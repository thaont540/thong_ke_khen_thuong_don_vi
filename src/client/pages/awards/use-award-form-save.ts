import { useState } from "react";
import { type AwardDuplicate, awardDuplicateSchema } from "../../../shared/schemas/award-schemas";
import { useToast } from "../../components/ui/toast-provider";
import { errorMessage, isApiError } from "../../lib/api-error";
import {
  type AwardFormErrors,
  type AwardFormKey,
  type AwardFormValues,
  FIELD_IDS,
  FIELD_ORDER,
  formValuesToPayload,
  validateAwardForm,
} from "./award-form-values";
import { useCreateAward, useUpdateAward } from "./use-awards-queries";

/** What happens after a successful save of a new record. */
export type AfterSave = "list" | "more";

interface Args {
  /** Record being edited (F09), null when adding (F03). */
  editId: number | null;
  /** `updated_at` of the loaded record (optimistic concurrency), edit mode only. */
  updatedAt?: string | undefined;
  values: AwardFormValues;
  needsVariant: boolean;
  /** Officer / team / unit name used in the success toast and duplicate dialog. */
  who: string;
  setErrors: (errors: AwardFormErrors) => void;
  onSaved: (after: AfterSave) => void;
}

function focusFirstError(errors: AwardFormErrors) {
  const key = FIELD_ORDER.find((k) => errors[k]);
  if (key) setTimeout(() => document.getElementById(FIELD_IDS[key])?.focus(), 0);
}

const isFormKey = (k: string): k is AwardFormKey => k in FIELD_IDS;

/** Validate -> POST/PUT -> handle 409 duplicate (confirm flow) and server field errors. */
export function useAwardFormSave(a: Args) {
  const create = useCreateAward();
  const update = useUpdateAward();
  const toast = useToast();
  const [dup, setDup] = useState<{ duplicates: AwardDuplicate[]; after: AfterSave } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;

  async function save(after: AfterSave, confirmDuplicate = false) {
    setFormError(null);
    const problems = validateAwardForm(a.values, a.needsVariant);
    if (Object.keys(problems).length > 0) {
      a.setErrors(problems);
      focusFirstError(problems);
      return;
    }
    const body = formValuesToPayload(a.values, confirmDuplicate);
    try {
      if (a.editId !== null) {
        await update.mutateAsync({
          id: a.editId,
          body: a.updatedAt ? { ...body, updated_at: a.updatedAt } : body,
        });
      } else await create.mutateAsync(body);
    } catch (e) {
      handleError(e, after);
      return;
    }
    setDup(null);
    toast(
      a.editId !== null
        ? `Đã cập nhật khen thưởng của ${a.who}`
        : `Đã lưu khen thưởng cho ${a.who}`,
    );
    a.onSaved(after);
  }

  function handleError(e: unknown, after: AfterSave) {
    if (isApiError(e) && e.code === "DUPLICATE") {
      const parsed = awardDuplicateSchema.array().safeParse(e.extra.duplicates);
      if (parsed.success && parsed.data.length > 0) {
        setDup({ duplicates: parsed.data, after });
        return;
      }
    }
    setDup(null);
    const fields = isApiError(e) ? e.fields : undefined;
    const mapped: AwardFormErrors = {};
    for (const [k, msg] of Object.entries(fields ?? {})) if (isFormKey(k)) mapped[k] = msg;
    if (Object.keys(mapped).length > 0) {
      a.setErrors(mapped);
      focusFirstError(mapped);
    } else {
      setFormError(errorMessage(e));
    }
  }

  return { save, dup, cancelDuplicate: () => setDup(null), formError, pending };
}
