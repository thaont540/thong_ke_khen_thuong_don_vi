import { validateAwardChoice } from "../../shared/award-type-rules";
import type { Subject } from "../../shared/domain-enums";
import type { AwardInput } from "../../shared/schemas/award-schemas";
import type { MasterDataDto } from "../../shared/schemas/master-data-dto";
import { AppError } from "../lib/app-error";

export interface AwardProblem {
  field: string;
  message: string;
}

const CHOICE_PROBLEMS = {
  UNKNOWN_TYPE: { field: "award_type_id", message: "Danh hiệu / khen thưởng không tồn tại" },
  SUBJECT_MISMATCH: {
    field: "award_type_id",
    message: "Danh hiệu / khen thưởng không áp dụng cho đối tượng này",
  },
  VARIANT_REQUIRED: { field: "award_variant_id", message: "Cần chọn loại huân chương" },
  VARIANT_MISMATCH: {
    field: "award_variant_id",
    message: "Loại huân chương không thuộc khen thưởng đã chọn",
  },
} as const;

/** Subset of `AwardInput` the master-data rules need (import rows reuse it before building a full input). */
export interface AwardRuleInput {
  subject: Subject;
  award_type_id: number;
  award_variant_id: number | null;
  authority_id: number;
  unit_id?: number | null;
  team_id?: number | null;
}

/**
 * Master-data rules of spec §2 (pure): matrix by subject, variant required iff the type needs it and
 * belongs to the type, authority exists, collective team belongs to unit. Returns the first problem.
 * Mirrors DB triggers so users get field-level messages instead of a trigger abort.
 */
export function findAwardProblem(
  master: MasterDataDto,
  input: AwardRuleInput,
): AwardProblem | null {
  const choice = validateAwardChoice(
    master,
    input.subject,
    input.award_type_id,
    input.award_variant_id,
  );
  if (choice !== "ok") return CHOICE_PROBLEMS[choice];
  if (!master.authorities.some((a) => a.id === input.authority_id)) {
    return { field: "authority_id", message: "Cấp quyết định không tồn tại" };
  }
  if (input.subject === "TAP_THE") {
    const unit = master.units.find((u) => u.id === input.unit_id);
    if (!unit) return { field: "unit_id", message: "Đơn vị không tồn tại" };
    if (input.team_id != null && !unit.teams.some((t) => t.id === input.team_id)) {
      return { field: "team_id", message: "Đội không thuộc đơn vị đã chọn" };
    }
  }
  return null;
}

/** Throws 422 CONSTRAINT with a per-field message when `input` breaks a master-data rule. */
export function assertValidAward(master: MasterDataDto, input: AwardInput): void {
  const problem = findAwardProblem(master, input);
  if (problem) {
    throw new AppError(422, "CONSTRAINT", problem.message, { [problem.field]: problem.message });
  }
}
