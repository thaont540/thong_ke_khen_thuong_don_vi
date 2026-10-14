import type { OfficerListItem } from "../../../shared/schemas/officer-schemas";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { useToast } from "../../components/ui/toast-provider";
import { errorMessage } from "../../lib/api-error";
import { useDeleteOfficer } from "./use-officers-queries";

interface Props {
  officer: OfficerListItem;
  onClose: () => void;
}

/** BR-05: names the officer and the number of awards that are deleted along with them. */
export function OfficerDeleteDialog({ officer, onClose }: Props) {
  const toast = useToast();
  const remove = useDeleteOfficer();
  const onConfirm = () =>
    remove.mutate(officer.id, {
      onSuccess: (r) => {
        toast(`Đã xóa cán bộ ${officer.full_name} và ${r.deleted_awards} khen thưởng`);
        onClose();
      },
      onError: (e) => {
        toast(errorMessage(e), "error");
        onClose();
      },
    });
  return (
    <ConfirmDialog
      title="Xóa cán bộ"
      message={`Xóa cán bộ ${officer.full_name} (số hiệu ${officer.badge_number})? ${officer.award_count} khen thưởng của cán bộ này sẽ bị xóa theo.`}
      confirmLabel="Xóa"
      danger
      busy={remove.isPending}
      onConfirm={onConfirm}
      onCancel={onClose}
    />
  );
}
