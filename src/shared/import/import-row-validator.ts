import { awardTypesFor } from "../award-type-rules";
import { parseDateInput } from "../date-format";
import { FORM, type Form, SUBJECT, type Subject } from "../domain-enums";
import { collapseSpaces, normalizeText } from "../normalize-text";
import type { ImportRow } from "../schemas/award-import-schemas";
import { type AwardInput, awardInputSchema } from "../schemas/award-schemas";
import type { AwardTypeDto } from "../schemas/master-data-dto";
import { type ImportLookups, normalizeOfficerCode } from "./import-lookup-maps";

/** What the preview table shows for a row, whether or not it is valid. */
export interface ImportRowDisplay {
  subjectName: string;
  subject: Subject | null;
  form: Form | null;
  awardLabel: string;
  year: string;
  decision: string;
}

export interface ImportRowCheck {
  errors: string[];
  /** Ready-to-save input, only when `errors` is empty. */
  input: AwardInput | null;
  display: ImportRowDisplay;
}

const MIN_YEAR = 1990;
const MAX_YEAR = 2100;

const SUBJECT_BY_TEXT: Record<string, Subject> = {
  "tập thể": SUBJECT.TAP_THE,
  "cá nhân": SUBJECT.CA_NHAN,
};
const FORM_BY_TEXT: Record<string, Form> = {
  "danh hiệu": FORM.DANH_HIEU,
  "khen thưởng": FORM.KHEN_THUONG,
};

const MEDAL_HINT = "Ghi rõ loại huân chương, ví dụ Huân chương Chiến công hạng Ba";
const text = (v: string | undefined): string => collapseSpaces(v ?? "");

function awardKindLabel(subject: Subject, form: Form): string {
  if (form === FORM.KHEN_THUONG) return "hình thức khen thưởng";
  return subject === SUBJECT.TAP_THE ? "danh hiệu tập thể" : "danh hiệu cá nhân";
}

interface AwardChoice {
  type: AwardTypeDto;
  variantId: number | null;
}

/** Resolves the "Danh hiệu / khen thưởng" cell against the spec §2 matrix; pushes the error otherwise. */
function resolveAward(
  row: ImportRow,
  subject: Subject,
  form: Form,
  lk: ImportLookups,
  errors: string[],
): AwardChoice | null {
  const raw = text(row.award_name);
  if (!raw) {
    errors.push("Thiếu danh hiệu / khen thưởng");
    return null;
  }
  const key = normalizeText(raw);
  const types = awardTypesFor(lk.master, subject, form);
  const byName = types.find((t) => normalizeText(t.name) === key);
  if (byName && !byName.requires_variant) return { type: byName, variantId: null };

  const variant = lk.variantByName.get(key);
  const variantType = variant && types.find((t) => t.id === variant.award_type_id);
  if (variant && variantType) return { type: variantType, variantId: variant.id };

  if (byName || (key.startsWith("huân chương") && form === FORM.KHEN_THUONG)) {
    errors.push(MEDAL_HINT);
  } else if (key.startsWith("huân chương")) {
    errors.push("Huân chương thuộc hình thức Khen thưởng");
  } else {
    errors.push(`"${raw}" không phải ${awardKindLabel(subject, form)} hợp lệ`);
  }
  return null;
}

/** Officer part of a Cá nhân row; returns the officer when found and consistent with unit/team. */
function resolveOfficer(
  row: ImportRow,
  lk: ImportLookups,
  place: { unit: { id: number; name: string } | null; team: { id: number; name: string } | null },
  errors: string[],
) {
  const code = collapseSpaces(row.officer_code ?? "").toUpperCase();
  if (!code) {
    errors.push("Cá nhân cần có mã cán bộ");
    return null;
  }
  const officer = lk.officerByCode.get(normalizeOfficerCode(code));
  if (!officer) {
    errors.push(`Không tìm thấy cán bộ mã ${code}`);
    return null;
  }
  if (place.unit && officer.unit_id !== place.unit.id) {
    errors.push(`Cán bộ ${officer.full_name} không thuộc ${place.unit.name}`);
    return null;
  }
  if (place.team && officer.team_id !== place.team.id) {
    errors.push(`Cán bộ ${officer.full_name} không thuộc ${place.team.name}`);
    return null;
  }
  return officer;
}

function parseYear(raw: string | number): number | null {
  const s = String(raw ?? "").trim();
  if (!/^\d{4}(\.0+)?$/.test(s)) return null;
  const y = Number.parseInt(s, 10);
  return y >= MIN_YEAR && y <= MAX_YEAR ? y : null;
}

/**
 * Pure per-row check of spec §5 (browser preview and Worker use the same code). Column values are
 * matched by BR-07 normalized text; collects every error of the row, like the mockup.
 */
export function validateImportRow(row: ImportRow, lk: ImportLookups): ImportRowCheck {
  const errors: string[] = [];
  const subject = SUBJECT_BY_TEXT[normalizeText(row.subject ?? "")] ?? null;
  if (!subject) errors.push("Đối tượng phải là Tập thể hoặc Cá nhân");

  const unitRaw = text(row.unit);
  const unit = unitRaw ? (lk.unitByKey.get(normalizeText(unitRaw)) ?? null) : null;
  if (!unitRaw) errors.push("Thiếu đơn vị");
  else if (!unit) errors.push(`Không tìm thấy đơn vị "${unitRaw}"`);

  const teamRaw = text(row.team);
  let team: { id: number; name: string } | null = null;
  if (teamRaw && unit) {
    team = lk.teamsByUnit.get(unit.id)?.get(normalizeText(teamRaw)) ?? null;
    if (!team) errors.push(`Đội "${teamRaw}" không thuộc ${unit.name}`);
  }

  const officer =
    subject === SUBJECT.CA_NHAN ? resolveOfficer(row, lk, { unit, team }, errors) : null;

  const form = FORM_BY_TEXT[normalizeText(row.form ?? "")] ?? null;
  if (!form) errors.push("Hình thức phải là Danh hiệu hoặc Khen thưởng");

  const awardRaw = text(row.award_name);
  let choice: AwardChoice | null = null;
  if (subject && form) choice = resolveAward(row, subject, form, lk, errors);
  else if (!awardRaw) errors.push("Thiếu danh hiệu / khen thưởng");

  const authorityRaw = text(row.authority);
  let authorityId: number | null = choice?.type.default_authority_id ?? null;
  if (authorityRaw) {
    authorityId = lk.authorityByName.get(normalizeText(authorityRaw)) ?? null;
    if (authorityId === null) errors.push(`Không tìm thấy cấp quyết định "${authorityRaw}"`);
  }

  const year = parseYear(row.year);
  if (year === null) errors.push("Năm không hợp lệ");
  const decision = text(row.decision_number);
  if (!decision) errors.push("Thiếu số quyết định");
  else if (decision.length > 50) errors.push("Số quyết định tối đa 50 ký tự");
  const date = parseDateInput(String(row.decision_date ?? ""));
  if (!date) errors.push("Ngày quyết định phải theo dạng dd/mm/yyyy");
  const achievement = text(row.achievement);
  if (!achievement) errors.push("Thiếu chi tiết giải thưởng");
  else if (achievement.length > 2000) errors.push("Chi tiết giải thưởng tối đa 2000 ký tự");
  const note = text(row.note);
  if (note.length > 500) errors.push("Ghi chú tối đa 500 ký tự");

  const display: ImportRowDisplay = {
    subjectName: officer?.full_name ?? team?.name ?? unit?.name ?? "—",
    subject,
    form,
    awardLabel: awardRaw,
    year: String(row.year ?? "").trim(),
    decision,
  };
  if (errors.length > 0 || !subject || !unit || !choice || !authorityId || !year || !date) {
    return { errors, input: null, display };
  }
  const parsed = awardInputSchema.safeParse({
    subject,
    ...(subject === SUBJECT.CA_NHAN
      ? { officer_id: officer?.id }
      : { unit_id: unit.id, team_id: team?.id ?? null }),
    award_type_id: choice.type.id,
    award_variant_id: choice.variantId,
    year,
    decision_number: decision,
    decision_date: date,
    authority_id: authorityId,
    achievement,
    note: note || null,
  });
  if (!parsed.success) return { errors: ["Dữ liệu dòng không hợp lệ"], input: null, display };
  return { errors: [], input: parsed.data, display };
}
