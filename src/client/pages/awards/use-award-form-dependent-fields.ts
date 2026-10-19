import { awardTypesFor, variantsFor } from "../../../shared/award-type-rules";
import type { Form, Subject } from "../../../shared/domain-enums";
import type { MasterDataDto } from "../../../shared/schemas/master-data-dto";
import type { OfficerOption } from "../../../shared/schemas/officer-schemas";
import type { AwardFormValues } from "./award-form-values";

export type SetAwardForm = (patch: Partial<AwardFormValues>) => void;

/**
 * Cascading rules of spec F03: lists derive from the current values, and each user change returns
 * a patch that keeps still-valid dependent values and clears the rest. Prefill (edit mode) never
 * runs these handlers, so stored values (e.g. an officer who has since moved) stay untouched.
 */
export function useAwardFormDependentFields(
  values: AwardFormValues,
  set: SetAwardForm,
  master: MasterDataDto,
  officers: readonly OfficerOption[],
) {
  const unitId = values.unit_id ? Number(values.unit_id) : null;
  const teamId = values.team_id ? Number(values.team_id) : null;
  const officerId = values.officer_id ? Number(values.officer_id) : null;
  const typeId = values.award_type_id ? Number(values.award_type_id) : null;

  const unit = master.units.find((u) => u.id === unitId) ?? null;
  const typeOptions = awardTypesFor(master, values.subject, values.form);
  const selectedType = master.award_types.find((t) => t.id === typeId) ?? null;
  const needsVariant = selectedType?.requires_variant ?? false;
  const variantOptions = needsVariant && typeId !== null ? variantsFor(master, typeId) : [];

  const inScope = (o: OfficerOption, u: number | null, t: number | null) =>
    u !== null && o.unit_id === u && (t === null || o.team_id === t);
  const selectedOfficer = officers.find((o) => o.id === officerId) ?? null;
  const officerChoices = officers.filter(
    (o) => inScope(o, unitId, teamId) || o.id === selectedOfficer?.id,
  );

  const typePatch = (subject: Subject, form: Form): Partial<AwardFormValues> =>
    awardTypesFor(master, subject, form).some((t) => t.id === typeId)
      ? {}
      : { award_type_id: "", award_variant_id: "" };

  return {
    unit,
    teams: unit?.teams ?? [],
    typeOptions,
    selectedType,
    needsVariant,
    variantOptions,
    officerChoices,
    selectedOfficer,
    set,
    setOfficer: (id: string) => set({ officer_id: id }),
    changeSubject: (subject: Subject) => {
      // Xếp loại cán bộ is individual-only: switching to Tập thể falls back to Danh hiệu.
      const form: Form =
        subject === "TAP_THE" && values.form === "XEP_LOAI" ? "DANH_HIEU" : values.form;
      set({
        subject,
        form,
        ...(subject === "TAP_THE" ? { officer_id: "" } : {}),
        ...typePatch(subject, form),
      });
    },
    changeForm: (form: Form) => set({ form, ...typePatch(values.subject, form) }),
    changeUnit: (nextUnit: string) =>
      set({
        unit_id: nextUnit,
        team_id: "",
        ...(selectedOfficer && !inScope(selectedOfficer, nextUnit ? Number(nextUnit) : null, null)
          ? { officer_id: "" }
          : {}),
      }),
    changeTeam: (nextTeam: string) =>
      set({
        team_id: nextTeam,
        ...(selectedOfficer && !inScope(selectedOfficer, unitId, nextTeam ? Number(nextTeam) : null)
          ? { officer_id: "" }
          : {}),
      }),
    changeType: (id: string) => {
      const type = master.award_types.find((t) => t.id === Number(id));
      set({
        award_type_id: id,
        award_variant_id: "",
        ...(type ? { authority_id: String(type.default_authority_id) } : {}),
      });
    },
  };
}

export type AwardFormDependent = ReturnType<typeof useAwardFormDependentFields>;
