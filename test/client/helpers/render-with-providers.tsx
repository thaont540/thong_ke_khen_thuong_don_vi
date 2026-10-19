import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { vi } from "vitest";
import { routes } from "../../../src/client/app-router";
import { ToastProvider } from "../../../src/client/components/ui/toast-provider";
import type { Role } from "../../../src/shared/domain-enums";
import type { MeResponse } from "../../../src/shared/schemas/auth-schemas";
import type { UserDto } from "../../../src/shared/schemas/user-schemas";

export interface MockReply {
  status?: number;
  body?: unknown;
}
export type MockHandler = MockReply | ((req: { url: URL; body: unknown }) => MockReply);
export interface RecordedCall {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
}

/** Stubs global fetch (the api-client boundary). Keys: "METHOD /path". Unknown routes fail loudly. */
export function mockApi(handlers: Record<string, MockHandler>) {
  const calls: RecordedCall[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    const body =
      init?.body instanceof FormData
        ? init.body
        : typeof init?.body === "string"
          ? JSON.parse(init.body)
          : undefined;
    calls.push({ method, path: url.pathname, query: url.searchParams, body });
    const h = handlers[`${method} ${url.pathname}`];
    if (!h) throw new Error(`Unmocked request: ${method} ${url.pathname}`);
    const reply = typeof h === "function" ? h({ url, body }) : h;
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fn);
  return { calls, fn };
}

export const errorBody = (code: string, message: string, fields?: Record<string, string>) => ({
  error: { code, message, ...(fields ? { fields } : {}) },
});

export const makeMe = (role: Role, over: Partial<MeResponse> = {}): MeResponse => ({
  id: 1,
  username: `${role.toLowerCase()}1`,
  full_name: `Người ${role}`,
  role,
  must_change_password: false,
  ...over,
});

export const makeUser = (over: Partial<UserDto> = {}): UserDto => ({
  id: 2,
  username: "bien.tap",
  full_name: "Biên Tập Viên",
  role: "EDITOR",
  is_active: true,
  is_locked: false,
  must_change_password: false,
  last_login_at: null,
  ...over,
});

export function renderApp(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...utils, router, queryClient };
}
