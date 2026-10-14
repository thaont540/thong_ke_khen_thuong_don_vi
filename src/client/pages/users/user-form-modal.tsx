import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ROLE } from "../../../shared/domain-enums";
import {
  type UserCreate,
  type UserDto,
  userCreateSchema,
} from "../../../shared/schemas/user-schemas";
import { FormField, fieldA11y } from "../../components/ui/form-field";
import { ModalDialog } from "../../components/ui/modal-dialog";
import { SelectField } from "../../components/ui/select-field";
import { errorMessage, isApiError } from "../../lib/api-error";
import { fieldMessage } from "../../lib/field-message";
import { generatePassword } from "../../lib/generate-password";
import { useCreateUser, useUpdateUser } from "./use-users-queries";

export const ROLE_OPTIONS = [
  { value: ROLE.ADMIN, label: "Quản trị" },
  { value: ROLE.EDITOR, label: "Biên tập" },
  { value: ROLE.VIEWER, label: "Xem" },
];

interface Props {
  /** null = create. */
  user: UserDto | null;
  isSelf: boolean;
  onClose: () => void;
  /** Called after save; `tempPassword` is set only on create. */
  onSaved: (result: { username: string; tempPassword?: string }) => void;
}

const FORM_ID = "user-form";

export function UserFormModal({ user, isSelf, onClose, onSaved }: Props) {
  const create = useCreateUser();
  const update = useUpdateUser();
  const editing = user !== null;
  const form = useForm<UserCreate>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: {
      username: user?.username ?? "",
      full_name: user?.full_name ?? "",
      role: user?.role ?? ROLE.VIEWER,
      temp_password: editing ? generatePassword() : "",
    },
  });
  const { errors } = form.formState;
  const busy = create.isPending || update.isPending;

  const fail = (e: unknown) => {
    const fields = isApiError(e) ? e.fields : undefined;
    let mapped = false;
    for (const name of ["username", "full_name", "role", "temp_password"] as const) {
      if (fields?.[name]) {
        form.setError(name, { message: fields[name] });
        mapped = true;
      }
    }
    if (!mapped) form.setError("root.server", { message: errorMessage(e) });
  };

  const submit = form.handleSubmit((v) => {
    if (user) {
      update.mutate(
        { id: user.id, body: { full_name: v.full_name, role: v.role } },
        { onSuccess: () => onSaved({ username: user.username }), onError: fail },
      );
    } else {
      create.mutate(v, {
        onSuccess: (u) => onSaved({ username: u.username, tempPassword: v.temp_password }),
        onError: fail,
      });
    }
  });

  const pw = fieldMessage(errors.temp_password, "Mật khẩu tạm tối thiểu 10 ký tự");
  const fullNameError = fieldMessage(errors.full_name, "Nhập họ tên");
  const usernameError = fieldMessage(errors.username, "Nhập tên đăng nhập");
  return (
    <ModalDialog
      title={editing ? "Sửa người dùng" : "Thêm người dùng"}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button type="submit" form={FORM_ID} className="btn btn-primary" disabled={busy}>
            Lưu
          </button>
        </>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={submit} className="form-grid cols-2">
        {errors.root?.server ? (
          <div className="alert-inline full" role="alert">
            {errors.root.server.message}
          </div>
        ) : null}
        <FormField id="u-username" label="Tên đăng nhập" required error={usernameError}>
          <input
            type="text"
            autoComplete="off"
            disabled={editing}
            {...form.register("username")}
            {...fieldA11y("u-username", usernameError)}
          />
        </FormField>
        <FormField id="u-full-name" label="Họ tên" required error={fullNameError}>
          <input
            type="text"
            autoComplete="off"
            {...form.register("full_name")}
            {...fieldA11y("u-full-name", fullNameError)}
          />
        </FormField>
        <SelectField
          id="u-role"
          label="Vai trò"
          required
          options={ROLE_OPTIONS}
          disabled={isSelf}
          hint={isSelf ? "Không thể tự đổi vai trò của chính mình" : undefined}
          error={fieldMessage(errors.role, "Chọn vai trò")}
          {...form.register("role")}
        />
        {editing ? null : (
          <FormField
            id="u-temp-password"
            label="Mật khẩu tạm"
            required
            error={pw}
            hint="Tối thiểu 10 ký tự. Chỉ hiển thị một lần sau khi lưu."
            className="full"
          >
            <div className="pw-row">
              <input
                type="text"
                autoComplete="off"
                {...form.register("temp_password")}
                {...fieldA11y("u-temp-password", pw)}
              />
              <button
                type="button"
                className="btn"
                onClick={() =>
                  form.setValue("temp_password", generatePassword(), { shouldValidate: true })
                }
              >
                Tạo ngẫu nhiên
              </button>
            </div>
          </FormField>
        )}
      </form>
    </ModalDialog>
  );
}
