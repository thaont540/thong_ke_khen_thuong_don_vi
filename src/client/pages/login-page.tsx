import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";
import {
  type LoginRequest,
  loginRequestSchema,
  meResponseSchema,
} from "../../shared/schemas/auth-schemas";
import { FormField, fieldA11y } from "../components/ui/form-field";
import { api } from "../lib/api-client";
import { errorMessage } from "../lib/api-error";
import { QUERY_KEYS } from "../query-client";

/** Only same-origin absolute paths are honoured (blocks open redirects like //evil.com). */
export function safeNextPath(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login")
    ? next
    : "/";
}

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { username: "", password: "" },
  });
  const { errors } = form.formState;
  const usernameError = errors.username ? "Nhập tên đăng nhập" : undefined;
  const passwordError = errors.password ? "Nhập mật khẩu" : undefined;

  const login = useMutation({
    mutationFn: (body: LoginRequest) =>
      api.post("/api/auth/login", { body, schema: meResponseSchema, skipAuthRedirect: true }),
    onSuccess: (me) => {
      queryClient.clear();
      queryClient.setQueryData(QUERY_KEYS.me, me);
      navigate(me.must_change_password ? "/change-password" : safeNextPath(params.get("next")), {
        replace: true,
      });
    },
  });

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div className="brand">Thi đua, khen thưởng</div>
        <h1>Đăng nhập</h1>
        <form noValidate onSubmit={form.handleSubmit((v) => login.mutate(v))}>
          {login.error ? (
            <div className="alert-inline" role="alert">
              {errorMessage(login.error)}
            </div>
          ) : null}
          <FormField id="login-username" label="Tên đăng nhập" required error={usernameError}>
            <input
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              {...form.register("username")}
              {...fieldA11y("login-username", usernameError)}
            />
          </FormField>
          <FormField id="login-password" label="Mật khẩu" required error={passwordError}>
            <input
              type="password"
              autoComplete="current-password"
              {...form.register("password")}
              {...fieldA11y("login-password", passwordError)}
            />
          </FormField>
          <button type="submit" className="btn btn-primary" disabled={login.isPending}>
            Đăng nhập
          </button>
        </form>
      </div>
    </div>
  );
}

export const Component = LoginPage;
