import type { UserDto } from "../../../shared/schemas/user-schemas";
import { StatusBadge } from "../../components/ui/status-badge";
import { ROLE_LABEL } from "../../layout/user-menu";

function formatLastLogin(iso: string | null): string {
  if (!iso) return "Chưa đăng nhập";
  const d = new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("vi-VN");
}

function StatusCell({ u }: { u: UserDto }) {
  if (!u.is_active) return <StatusBadge tone="err">Đã khóa</StatusBadge>;
  if (u.is_locked) return <StatusBadge tone="warn">Tạm khóa</StatusBadge>;
  return <StatusBadge tone="ok">Hoạt động</StatusBadge>;
}

interface Props {
  items: UserDto[];
  selfId: number | undefined;
  onEdit: (u: UserDto) => void;
  onReset: (u: UserDto) => void;
  onToggle: (u: UserDto) => void;
  onDelete: (u: UserDto) => void;
}

/** Own row never offers lock / reset / delete (spec F08: no self-lock; self password via F07). */
export function UsersTable({ items, selfId, onEdit, onReset, onToggle, onDelete }: Props) {
  return (
    <div className="table-wrap">
      <table className="data-sm">
        <thead>
          <tr>
            <th>Tên đăng nhập</th>
            <th>Họ tên</th>
            <th>Vai trò</th>
            <th>Trạng thái</th>
            <th>Đăng nhập gần nhất</th>
            <th className="col-actions">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {items.map((u) => (
            <tr key={u.id}>
              <td className="who">{u.username}</td>
              <td>{u.full_name}</td>
              <td>{ROLE_LABEL[u.role]}</td>
              <td>
                <StatusCell u={u} />
              </td>
              <td className="decision">{formatLastLogin(u.last_login_at)}</td>
              <td className="col-actions">
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    aria-label={`Sửa ${u.username}`}
                    onClick={() => onEdit(u)}
                  >
                    Sửa
                  </button>
                  {u.id === selfId ? null : (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm"
                        aria-label={`Đặt lại mật khẩu ${u.username}`}
                        onClick={() => onReset(u)}
                      >
                        Đặt lại mật khẩu
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        aria-label={`${u.is_active ? "Khóa" : "Mở khóa"} ${u.username}`}
                        onClick={() => onToggle(u)}
                      >
                        {u.is_active ? "Khóa" : "Mở khóa"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        aria-label={`Xóa ${u.username}`}
                        onClick={() => onDelete(u)}
                      >
                        Xóa
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
