import type { DocumentItem } from "../../../shared/schemas/document-schemas";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { useToast } from "../../components/ui/toast-provider";
import { errorMessage } from "../../lib/api-error";
import { useDeleteDocument } from "./use-documents-queries";

export function DocumentDeleteDialog({
  document: doc,
  onClose,
}: {
  document: DocumentItem;
  onClose: () => void;
}) {
  const toast = useToast();
  const remove = useDeleteDocument();
  const onConfirm = () =>
    remove.mutate(doc.id, {
      onSuccess: () => {
        toast(`Đã xóa văn bản ${doc.doc_number}`);
        onClose();
      },
      onError: (e) => {
        toast(errorMessage(e), "error");
        onClose();
      },
    });
  return (
    <ConfirmDialog
      title="Xóa văn bản"
      message={`Xóa văn bản ${doc.doc_number} cùng tệp đính kèm "${doc.file_name}"? Thao tác này không thể hoàn tác.`}
      confirmLabel="Xóa"
      danger
      busy={remove.isPending}
      onConfirm={onConfirm}
      onCancel={onClose}
    />
  );
}
