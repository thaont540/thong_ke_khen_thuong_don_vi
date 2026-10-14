import { useState } from "react";
import { ModalDialog } from "../../components/ui/modal-dialog";

interface Props {
  title: string;
  username: string;
  password: string;
  onClose: () => void;
}

/** Shows a temporary password exactly once. The value lives only in the parent's state and is dropped on close. */
export function PasswordResultDialog({ title, username, password, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <ModalDialog
      narrow
      title={title}
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Đóng
        </button>
      }
    >
      <p className="confirm-text">
        Mật khẩu tạm của <strong>{username}</strong> chỉ hiển thị một lần. Hãy sao chép và gửi cho
        người dùng; họ sẽ phải đổi mật khẩu ở lần đăng nhập đầu tiên.
      </p>
      <div className="pw-result" style={{ marginTop: 12 }}>
        <code data-testid="temp-password">{password}</code>
        <button type="button" className="btn" onClick={copy}>
          {copied ? "Đã sao chép" : "Sao chép"}
        </button>
      </div>
    </ModalDialog>
  );
}
