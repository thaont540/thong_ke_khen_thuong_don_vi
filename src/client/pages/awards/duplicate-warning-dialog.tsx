import type { AwardDuplicate } from "../../../shared/schemas/award-schemas";
import { ModalDialog } from "../../components/ui/modal-dialog";

interface Props {
  /** Name of the officer / team / unit being saved. */
  who: string;
  duplicates: readonly AwardDuplicate[];
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** BR-08 warning: "… đã có … năm … (quyết định …). Bạn vẫn muốn lưu?" */
export function DuplicateWarningDialog({ who, duplicates, busy, onConfirm, onCancel }: Props) {
  const first = duplicates[0];
  return (
    <ModalDialog
      narrow
      title="Có thể bị trùng"
      onClose={onCancel}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Hủy
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={busy}>
            Vẫn lưu
          </button>
        </>
      }
    >
      <p className="confirm-text">
        {who} đã có {first?.type_name} năm {first?.year} (quyết định{" "}
        {duplicates.map((d) => d.decision_number).join(", ")}). Bạn vẫn muốn lưu?
      </p>
    </ModalDialog>
  );
}
