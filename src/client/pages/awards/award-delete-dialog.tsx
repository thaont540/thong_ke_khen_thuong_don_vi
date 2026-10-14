import type { AwardRecord } from "../../../shared/schemas/award-schemas";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { awardSubjectName, awardTitle } from "./award-display-text";

interface Props {
  record: AwardRecord;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AwardDeleteDialog({ record, busy, onConfirm, onCancel }: Props) {
  return (
    <ConfirmDialog
      title="Xóa khen thưởng"
      message={`Xóa "${awardTitle(record)}" năm ${record.year} của ${awardSubjectName(record)} (quyết định ${record.decision_number})?`}
      confirmLabel="Xóa"
      danger
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
