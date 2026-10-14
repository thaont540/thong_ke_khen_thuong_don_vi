import type { MasterDataDto } from "../../../shared/schemas/master-data-dto";
import type { AwardFormErrors, AwardFormValues } from "./award-form-values";
import type { AwardFormDependent, SetAwardForm } from "./use-award-form-dependent-fields";

export interface AwardSectionProps {
  values: AwardFormValues;
  errors: AwardFormErrors;
  set: SetAwardForm;
  dep: AwardFormDependent;
  master: MasterDataDto;
}
