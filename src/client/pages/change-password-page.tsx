import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import {
  type ChangePasswordRequest,
  changePasswordRequestSchema,
  PASSWORD_MIN_LENGTH,
} from "../../shared/schemas/auth-schemas";
import { FormField, fieldA11y } from "../components/ui/form-field";
import { useToast } from "../components/ui/toast-provider";
import { useCurrentUser } from "../hooks/use-current-user";
import { useLogout } from "../hooks/use-logout";
import { api } from "../lib/api-client";
import { errorMessage, isApiError } from "../lib/api-error";
import { fieldMessage } from "../lib/field-message";
import { QUERY_KEYS } from "../query-client";

const FIELDS = ["current_password", "new_password", "confirm_password"] as const;
type FieldName = (typeof FIELDS)[number];

const FIELD_FALLBACK: Record<FieldName, string> = {
  current_password: "Nhập mật khẩu hiện tại",
  new_password: `Mật khẩu mới tối thiểu ${PASSWORD_MIN_LENGTH} ký tự`,
  confirm_password: "Nhập lại mật khẩu mới",
};

const FIELD_LABEL: Record<FieldName, string> = {
  current_password: "Mật khẩu hiện tại",
  new_password: "Mật khẩu mới",
  confirm_password: "Nhập lại mật khẩu mới",
};

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const logout = useLogout();
  const { data: me } = useCurrentUser();
  const forced = me?.must_change_password ?? false;

  const form = useForm<ChangePasswordRequest>({
    resolver: zodResolver(changePasswordRequestSchema),
    defaultValues: { current_password: "", new_password: "", confirm_password: "" },
  });
  const { errors } = form.formState;

  const change = useMutation({
    mutationFn: (body: ChangePasswordRequest) =>
      api.post("/api/auth/change-password", { body, skipAuthRedirect: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.me });
      toast("Đã đổi mật khẩu");
      navigate("/", { replace: true });
    },
    onError: (e) => {
      const fields = isApiError(e) ? e.fields : undefined;
      let mapped = false;
      for (const name of FIELDS) {
        const msg = fields?.[name];
        if (msg) {
          form.setError(name, { message: msg });
          mapped = true;
        }
      }
      if (!mapped) form.setError("root.server", { message: errorMessage(e) });
    },
  });

  const field = (name: FieldName, autoComplete: string) => {
    const error = fieldMessage(errors[name], FIELD_FALLBACK[name]);
    return (
      <FormField
        id={`cp-${name}`}
        label={FIELD_LABEL[name]}
        required
        error={error}
        hint={name === "new_password" ? `Tối thiểu ${PASSWORD_MIN_LENGTH} ký tự` : undefined}
      >
        <input
          type="password"
          autoComplete={autoComplete}
          {...form.register(name)}
          {...fieldA11y(`cp-${name}`, error)}
        />
      </FormField>
    );
  };

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h1>Đổi mật khẩu</h1>
        {forced ? <p className="sub">Bạn cần đổi mật khẩu trước khi sử dụng hệ thống.</p> : null}
        <form noValidate onSubmit={form.handleSubmit((v) => change.mutate(v))}>
          {errors.root?.server ? (
            <div className="alert-inline" role="alert">
              {errors.root.server.message}
            </div>
          ) : null}
          {field("current_password", "current-password")}
          {field("new_password", "new-password")}
          {field("confirm_password", "new-password")}
          <div className="form-actions">
            {forced ? (
              <button type="button" className="btn" onClick={() => logout.mutate()}>
                Đăng xuất
              </button>
            ) : (
              <Link className="btn" to="/">
                Hủy
              </Link>
            )}
            <button type="submit" className="btn btn-primary" disabled={change.isPending}>
              Đổi mật khẩu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export const Component = ChangePasswordPage;
