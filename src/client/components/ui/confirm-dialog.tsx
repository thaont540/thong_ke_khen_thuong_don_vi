import { ModalDialog } from "./modal-dialog";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog(p: ConfirmDialogProps) {
  return (
    <ModalDialog
      narrow
      title={p.title}
      onClose={p.onCancel}
      busy={p.busy}
      footer={
        <>
          <button type="button" className="btn" onClick={p.onCancel} disabled={p.busy}>
            Hủy
          </button>
          <button
            type="button"
            className={p.danger ? "btn btn-danger-solid" : "btn btn-primary"}
            onClick={p.onConfirm}
            disabled={p.busy}
          >
            {p.confirmLabel}
          </button>
        </>
      }
    >
      <p className="confirm-text">{p.message}</p>
    </ModalDialog>
  );
}
