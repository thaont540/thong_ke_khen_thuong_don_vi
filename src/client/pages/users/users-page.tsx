import { useEffect, useState } from "react";
import type { UserDto } from "../../../shared/schemas/user-schemas";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { EmptyState } from "../../components/ui/empty-state";
import { PaginationBar } from "../../components/ui/pagination-bar";
import { useToast } from "../../components/ui/toast-provider";
import { useCurrentUser } from "../../hooks/use-current-user";
import { errorMessage } from "../../lib/api-error";
import { PasswordResultDialog } from "./reset-password-result-dialog";
import {
  useDeleteUser,
  useResetUserPassword,
  useUpdateUser,
  useUsersList,
} from "./use-users-queries";
import { UserFormModal } from "./user-form-modal";
import { UsersTable } from "./users-table";
import { UsersToolbar } from "./users-toolbar";

const PAGE_SIZE = 10;

type Dialog =
  | { kind: "form"; user: UserDto | null }
  | { kind: "reset"; user: UserDto }
  | { kind: "toggle"; user: UserDto }
  | { kind: "delete"; user: UserDto }
  | { kind: "password"; title: string; username: string; password: string };

export function UsersPage() {
  const toast = useToast();
  const { data: me } = useCurrentUser();
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const list = useUsersList({ q, page, size: PAGE_SIZE });
  const update = useUpdateUser();
  const reset = useResetUserPassword();
  const remove = useDeleteUser();

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(input.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [input]);

  const close = () => setDialog(null);
  const fail = (e: unknown) => {
    toast(errorMessage(e), "error");
    close();
  };

  const onToggle = (u: UserDto) =>
    update.mutate(
      { id: u.id, body: { is_active: !u.is_active } },
      {
        onSuccess: () => {
          toast(u.is_active ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản");
          close();
        },
        onError: fail,
      },
    );
  const onReset = (u: UserDto) =>
    reset.mutate(u.id, {
      onSuccess: (r) =>
        setDialog({
          kind: "password",
          title: "Đặt lại mật khẩu",
          username: u.username,
          password: r.temp_password,
        }),
      onError: fail,
    });
  const onDelete = (u: UserDto) =>
    remove.mutate(u.id, {
      onSuccess: () => {
        toast("Đã xóa tài khoản");
        close();
      },
      onError: fail,
    });

  const items = list.data?.items ?? [];
  return (
    <>
      <UsersToolbar
        search={input}
        onSearch={setInput}
        onAdd={() => setDialog({ kind: "form", user: null })}
      />

      <section className="table-card" aria-busy={list.isFetching}>
        {list.isError ? (
          <EmptyState
            message={errorMessage(list.error)}
            action={
              <button type="button" className="btn" onClick={() => list.refetch()}>
                Thử lại
              </button>
            }
          />
        ) : null}
        {list.isPending ? <EmptyState message="Đang tải…" /> : null}
        {list.data && items.length === 0 ? (
          <EmptyState message="Không có người dùng phù hợp." />
        ) : null}
        {items.length > 0 ? (
          <UsersTable
            items={items}
            selfId={me?.id}
            onEdit={(user) => setDialog({ kind: "form", user })}
            onReset={(user) => setDialog({ kind: "reset", user })}
            onToggle={(user) => setDialog({ kind: "toggle", user })}
            onDelete={(user) => setDialog({ kind: "delete", user })}
          />
        ) : null}
        <PaginationBar
          page={page}
          size={PAGE_SIZE}
          total={list.data?.total ?? 0}
          onPage={setPage}
        />
      </section>

      {dialog?.kind === "form" ? (
        <UserFormModal
          user={dialog.user}
          isSelf={dialog.user?.id === me?.id}
          onClose={close}
          onSaved={({ username, tempPassword }) =>
            tempPassword
              ? setDialog({
                  kind: "password",
                  title: "Đã tạo người dùng",
                  username,
                  password: tempPassword,
                })
              : (toast("Đã lưu người dùng"), close())
          }
        />
      ) : null}
      {dialog?.kind === "password" ? (
        <PasswordResultDialog
          title={dialog.title}
          username={dialog.username}
          password={dialog.password}
          onClose={close}
        />
      ) : null}
      {dialog?.kind === "reset" ? (
        <ConfirmDialog
          title="Đặt lại mật khẩu"
          message={`Tạo mật khẩu tạm mới cho ${dialog.user.username}? Mọi phiên đăng nhập của người này sẽ bị hủy.`}
          confirmLabel="Đặt lại"
          busy={reset.isPending}
          onConfirm={() => onReset(dialog.user)}
          onCancel={close}
        />
      ) : null}
      {dialog?.kind === "toggle" ? (
        <ConfirmDialog
          title={dialog.user.is_active ? "Khóa tài khoản" : "Mở khóa tài khoản"}
          message={
            dialog.user.is_active
              ? `Khóa tài khoản ${dialog.user.username}? Người này sẽ bị đăng xuất ngay.`
              : `Mở khóa tài khoản ${dialog.user.username}?`
          }
          confirmLabel={dialog.user.is_active ? "Khóa" : "Mở khóa"}
          danger={dialog.user.is_active}
          busy={update.isPending}
          onConfirm={() => onToggle(dialog.user)}
          onCancel={close}
        />
      ) : null}
      {dialog?.kind === "delete" ? (
        <ConfirmDialog
          title="Xóa tài khoản"
          message={`Xóa tài khoản ${dialog.user.username}? Chỉ xóa được tài khoản chưa tạo dữ liệu; nếu không, hãy khóa tài khoản.`}
          confirmLabel="Xóa"
          danger
          busy={remove.isPending}
          onConfirm={() => onDelete(dialog.user)}
          onCancel={close}
        />
      ) : null}
    </>
  );
}

export const Component = UsersPage;
