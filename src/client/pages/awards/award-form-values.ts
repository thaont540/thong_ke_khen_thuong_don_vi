import { isValidIsoDate } from "../../../shared/date-format";
import type { Form, Subject } from "../../../shared/domain-enums";
import type { AwardInput, AwardRecord } from "../../../shared/schemas/award-schemas";

/** Form state: every select/input is a string ("" = empty) so controls stay controlled. */
export interface AwardFormValues {
  subject: Subject;
  unit_id: string;
  team_id: string;
  officer_id: string;
  form: Form;
  award_type_id: string;
  award_variant_id: string;
  year: string;
  decision_number: string;
  decision_date: string;
  authority_id: string;
  achievement: string;
  note: string;
}

export type AwardFormKey = keyof AwardFormValues;
export type AwardFormErrors = Partial<Record<AwardFormKey, string>>;

/** DOM id of each focusable field (focus-first-error + label association). */
export const FIELD_IDS: Record<AwardFormKey, string> = {
  subject: "a-subject",
  unit_id: "a-unit",
  team_id: "a-team",
  officer_id: "a-officer",
  form: "a-form",
  award_type_id: "a-award",
  award_variant_id: "a-medal",
  year: "a-year",
  decision_number: "a-decision",
  decision_date: "a-date",
  authority_id: "a-authority",
  achievement: "a-details",
  note: "a-note",
};

/** Visual order, used to focus the first invalid field. */
export const FIELD_ORDER: AwardFormKey[] = [
  "unit_id",
  "officer_id",
  "award_type_id",
  "award_variant_id",
  "year",
  "decision_number",
  "decision_date",
  "authority_id",
  "achievement",
  "note",
];

export const emptyAwardForm = (): AwardFormValues => ({
  subject: "CA_NHAN",
  unit_id: "",
  team_id: "",
  officer_id: "",
  form: "DANH_HIEU",
  award_type_id: "",
  award_variant_id: "",
  year: String(new Date().getFullYear()),
  decision_number: "",
  decision_date: "",
  authority_id: "",
  achievement: "",
  note: "",
});

export const recordToFormValues = (r: AwardRecord): AwardFormValues => ({
  subject: r.subject,
  unit_id: String(r.unit_id),
  team_id: r.team_id === null ? "" : String(r.team_id),
  officer_id: r.officer_id === null ? "" : String(r.officer_id),
  form: r.form,
  award_type_id: String(r.award_type_id),
  award_variant_id: r.award_variant_id === null ? "" : String(r.award_variant_id),
  year: String(r.year),
  decision_number: r.decision_number,
  decision_date: r.decision_date,
  authority_id: String(r.authority_id),
  achievement: r.achievement,
  note: r.note ?? "",
});

/** Client-side required/length checks (spec F03); the server repeats every rule. */
export function validateAwardForm(v: AwardFormValues, needsVariant: boolean): AwardFormErrors {
  const e: AwardFormErrors = {};
  if (!v.unit_id) e.unit_id = "Chọn đơn vị";
  if (v.subject === "CA_NHAN" && !v.officer_id) e.officer_id = "Chọn cán bộ";
  if (!v.award_type_id) {
    e.award_type_id =
      v.form === "DANH_HIEU" ? "Chọn danh hiệu thi đua" : "Chọn hình thức khen thưởng";
  }
  if (needsVariant && !v.award_variant_id) e.award_variant_id = "Chọn loại huân chương";
  const year = Number(v.year);
  if (!v.year.trim() || !Number.isInteger(year) || year < 1990 || year > 2100) {
    e.year = "Năm khen thưởng từ 1990 đến 2100";
  }
  const decision = v.decision_number.trim();
  if (!decision) e.decision_number = "Nhập số quyết định";
  else if (decision.length > 50) e.decision_number = "Số quyết định tối đa 50 ký tự";
  if (!v.decision_date) e.decision_date = "Nhập ngày quyết định";
  else if (!isValidIsoDate(v.decision_date)) e.decision_date = "Ngày quyết định không hợp lệ";
  if (!v.authority_id) e.authority_id = "Chọn cấp quyết định";
  const achievement = v.achievement.trim();
  if (!achievement) e.achievement = "Nhập thành tích, nội dung khen thưởng";
  else if (achievement.length > 2000) e.achievement = "Tối đa 2.000 ký tự";
  if (v.note.trim().length > 500) e.note = "Tối đa 500 ký tự";
  return e;
}

/** Request body for POST/PUT (call only after `validateAwardForm` returned no errors). */
export function formValuesToPayload(v: AwardFormValues, confirmDuplicate: boolean): AwardInput {
  const common = {
    award_type_id: Number(v.award_type_id),
    award_variant_id: v.award_variant_id ? Number(v.award_variant_id) : null,
    year: Number(v.year),
    decision_number: v.decision_number.trim(),
    decision_date: v.decision_date,
    authority_id: Number(v.authority_id),
    achievement: v.achievement.trim(),
    note: v.note.trim() || null,
    ...(confirmDuplicate ? { confirm_duplicate: true } : {}),
  };
  return v.subject === "CA_NHAN"
    ? { subject: "CA_NHAN", officer_id: Number(v.officer_id), ...common }
    : {
        subject: "TAP_THE",
        unit_id: Number(v.unit_id),
        team_id: v.team_id ? Number(v.team_id) : null,
        ...common,
      };
}
