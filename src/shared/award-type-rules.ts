import type { Form, Subject } from "./domain-enums";
import type { AwardTypeDto, AwardVariantDto, MasterDataDto } from "./schemas/master-data-dto";

type Catalog = Pick<MasterDataDto, "award_types" | "award_variants">;

/** Spec §2 matrix: award types selectable for a subject + form, in sort order. */
export function awardTypesFor(
  catalog: Pick<Catalog, "award_types">,
  subject: Subject,
  form: Form,
): AwardTypeDto[] {
  return catalog.award_types
    .filter((t) => t.form === form && (t.subject_scope === "CA_HAI" || t.subject_scope === subject))
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function variantsFor(
  catalog: Pick<Catalog, "award_variants">,
  awardTypeId: number,
): AwardVariantDto[] {
  return catalog.award_variants
    .filter((v) => v.award_type_id === awardTypeId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export const defaultAuthorityId = (type: AwardTypeDto): number => type.default_authority_id;

export const requiresVariant = (type: AwardTypeDto): boolean => type.requires_variant;

/** Mirrors the DB triggers: type applies to subject, variant present iff required and belongs to type. */
export function validateAwardChoice(
  catalog: Catalog,
  subject: Subject,
  awardTypeId: number,
  awardVariantId: number | null,
): "ok" | "UNKNOWN_TYPE" | "SUBJECT_MISMATCH" | "VARIANT_REQUIRED" | "VARIANT_MISMATCH" {
  const type = catalog.award_types.find((t) => t.id === awardTypeId);
  if (!type) return "UNKNOWN_TYPE";
  if (type.subject_scope !== "CA_HAI" && type.subject_scope !== subject) return "SUBJECT_MISMATCH";
  if (awardVariantId === null) return type.requires_variant ? "VARIANT_REQUIRED" : "ok";
  const variant = catalog.award_variants.find((v) => v.id === awardVariantId);
  return variant && variant.award_type_id === type.id ? "ok" : "VARIANT_MISMATCH";
}
