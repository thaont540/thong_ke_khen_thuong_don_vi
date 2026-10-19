import { createBrowserRouter, type RouteObject, redirect } from "react-router";
import { RequireAuthRoute } from "./auth/require-auth-route";
import { RoleGuardRoute } from "./auth/role-guard-route";
import { AppLayout } from "./layout/app-layout";
import { RootShell } from "./root-shell";

/** Route table (exported for tests: createMemoryRouter(routes)). Feature pages are lazy. */
export const routes: RouteObject[] = [
  {
    element: <RootShell />,
    children: [
      { path: "/login", lazy: () => import("./pages/login-page") },
      {
        element: <RequireAuthRoute />,
        children: [
          { path: "/change-password", lazy: () => import("./pages/change-password-page") },
          {
            element: <AppLayout />,
            children: [
              { index: true, lazy: () => import("./pages/awards/awards-list-page") },
              {
                element: <RoleGuardRoute screen="award-create" />,
                children: [
                  { path: "/awards/new", lazy: () => import("./pages/awards/award-form-page") },
                  {
                    path: "/awards/:id/edit",
                    lazy: () => import("./pages/awards/award-form-page"),
                  },
                ],
              },
              {
                element: <RoleGuardRoute screen="officers" />,
                children: [
                  { path: "/officers", lazy: () => import("./pages/officers/officers-page") },
                ],
              },
              {
                element: <RoleGuardRoute screen="units" />,
                children: [{ path: "/units", lazy: () => import("./pages/units/units-page") }],
              },
              {
                element: <RoleGuardRoute screen="documents" />,
                children: [
                  { path: "/documents", lazy: () => import("./pages/documents/documents-page") },
                ],
              },
              {
                element: <RoleGuardRoute screen="users" />,
                children: [{ path: "/users", lazy: () => import("./pages/users/users-page") }],
              },
            ],
          },
        ],
      },
      { path: "*", loader: () => redirect("/") },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
