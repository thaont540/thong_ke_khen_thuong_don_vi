# Phase 04 — Frontend shell, design system, auth & user screens

## Context Links
- `docs/mockup.html` (CSS vars lines 13–50, sidebar `.side`/`.nav` ~line 291, modal/toast/table styles)
- Spec §1 roles & menu rules, §6 F07/F08 UI
- Contracts: `src/shared/schemas/*`, `src/shared/role-permissions.ts` (phase 02)

## Overview
- Priority: P1. Status: done. Effort 10h. Depends: 02. Parallel with 03 (codes against zod contracts; final integration check needs 03).
- SPA bootstrap, ported design tokens (light/dark via `prefers-color-scheme`), layout + role menu, router + guards, API client, reusable UI primitives, login, change-password, F08 users screen. Creates stub pages for 05/06/07.

## Key Insights
- Mockup tokens: `--bg --surface --surface-2 --ink --muted --line --primary --primary-ink --primary-soft --gold --gold-soft --red --red-soft --focus`; dark overrides in media query. Port as-is; no theme toggle.
- Font Be Vietnam Pro 400/500/600/700 self-hosted (@fontsource) -> CSP `font-src 'self'`, works offline of Google.
- Menu (spec §1): VIEWER -> Danh hiệu, khen thưởng; EDITOR +Thêm khen thưởng; ADMIN +Quản lý cán bộ, Quản lý đơn vị, Quản lý người dùng. Forbidden URL -> redirect `/` + toast "Bạn không có quyền truy cập chức năng này".
- Server is the authority; UI hides only.

## Requirements
Routes (`app-router.tsx`, createBrowserRouter, lazy pages):
| Path | Page | Roles | Owner |
|---|---|---|---|
| /login | login-page | anon | 04 |
| /change-password | change-password-page | all | 04 |
| / | awards-list-page (F01) | all | 06 (stub here) |
| /awards/new | award-form-page (F03+F04 tabs) | ADMIN, EDITOR | 06 |
| /awards/:id/edit | award-form-page (F09) | ADMIN, EDITOR | 06 |
| /officers | officers-page (F05) | ADMIN | 05 |
| /units | units-page (F06) | ADMIN | 05 |
| /users | users-page (F08) | ADMIN | 04 |
Guards: no session (GET /api/me 401) -> /login (keep `?next=`); `must_change_password` -> /change-password only; role check via `role-permissions`.
API client: `fetch` same-origin, JSON, `credentials:'same-origin'`; 401 -> clear query cache + /login; 403 -> toast; 409/422 -> typed error with `fields` for react-hook-form `setError`.
F08 UI per spec §6: table (username, họ tên, vai trò, trạng thái, đăng nhập gần nhất, actions), search, add/edit modal, random pw generate + copy (`crypto.getRandomValues`, shown once), reset pw dialog, lock/unlock confirm, delete (shown only when API allows -> handle 409 message).
Responsive: sidebar collapses to top bar/drawer < 900px like mockup.

## Architecture
`main.tsx` -> QueryClientProvider + ToastProvider -> RouterProvider. `AppLayout` (sidebar + user menu with họ tên, vai trò, Đổi mật khẩu, Đăng xuất) renders `<Outlet/>` + `<OfficerDetailModalHost/>` (stub here, implemented by 06; reads `?officer=&award=` search params).
Query keys: `['me']`, `['master']` (staleTime Infinity; invalidated by 05 unit mutations), feature keys defined by each feature.

## Related Code Files
Create (owned by 04):
- `index.html` (lang vi), `src/client/main.tsx`, `src/client/app-router.tsx`, `src/client/query-client.ts`
- `src/client/styles/design-tokens.css`, `base-layout.css`, `components.css`, `forms-and-tables.css` (each <200 lines, ported from mockup)
- `src/client/lib/api-client.ts`, `src/client/lib/api-error.ts`, `src/client/hooks/use-current-user.ts`, `use-master-data.ts`
- `src/client/auth/require-auth-route.tsx`, `role-guard-route.tsx`
- `src/client/layout/app-layout.tsx`, `sidebar-nav.tsx`, `user-menu.tsx`
- `src/client/components/ui/modal-dialog.tsx` (Esc, backdrop click, × , focus trap), `confirm-dialog.tsx`, `toast-provider.tsx`, `pagination-bar.tsx` ("Hiển thị a–b trong N"), `form-field.tsx`, `select-field.tsx`, `status-badge.tsx`, `empty-state.tsx`
- `src/client/components/unit-team-select.tsx` (shared unit+team pair; BR-03 lock when unit has no teams; team options for "Tất cả" unit = all teams; configurable first-option label) — used by 05, 06
- `src/client/pages/login-page.tsx`, `change-password-page.tsx`
- `src/client/pages/users/users-page.tsx`, `user-form-modal.tsx`, `reset-password-result-dialog.tsx`, `use-users-queries.ts`
- `public/_headers` (CSP `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'`, `X-Content-Type-Options`, `Referrer-Policy`)
- Stubs (ownership transfers): `src/client/pages/awards/*` + `src/client/officer-detail/officer-detail-modal-host.tsx` -> 06; `src/client/pages/officers/*`, `src/client/pages/units/*` -> 05
- Tests: `test/client/role-guard-and-menu.test.tsx`, `unit-team-select.test.tsx`, `login-page.test.tsx`, `change-password-page.test.tsx`, `users-page.test.tsx`, `modal-dialog.test.tsx`, `test/client/helpers/render-with-providers.tsx` (MSW-free: stub `fetch` per test with real zod-shaped payloads)

## Implementation Steps
1. Port CSS tokens + base styles; fontsource import.
2. Providers, api client, error type, current-user + master hooks.
3. Router with guards + stub pages; layout + menu from `role-permissions`.
4. UI primitives (modal a11y: role=dialog, aria-modal, focus restore).
5. Unit/team select (BR-03).
6. Login + change-password (react-hook-form + zodResolver with shared schemas; server field errors mapped).
7. F08 users page.
8. Tests; once 03 merged, manual run against local API.

## Test matrix
| Case | Covers |
|---|---|
| VIEWER sees 1 menu item, EDITOR 2, ADMIN 5 | §1 menu |
| VIEWER opens /units -> redirected / + toast | §1 forbidden URL |
| 401 from /api/me -> /login?next | F07 |
| must_change -> any route lands /change-password | F07 |
| login error message generic / locked | F07 |
| change-password validation (>=10, differ, match) | F07 |
| unit without teams locks team select at default | BR-03 |
| users: generated pw shown once, copy button, self row lacks lock/demote | F08 |
| modal closes on Esc/backdrop/×/Đóng | F02 behaviour reused |

## Todo List
- [x] tokens/styles ported
- [x] providers, api client, hooks
- [x] router + guards + layout/menu + stubs
- [x] UI primitives + unit-team-select
- [x] login, change-password
- [x] users page (F08)
- [x] tests + _headers

## Success Criteria
- Visual parity with mockup shell in light and dark (side-by-side screenshot check).
- Client tests green; Lighthouse a11y >= 90 on login.
- With 03 merged: full login -> forced change pw -> landing F01 stub works locally.

## Risk Assessment
| Risk | L x I | Mitigation |
|---|---|---|
| Contract drift vs 03 | Med x Med | both import same zod schemas; integration check step 8 |
| CSS port bloat | Low x Low | split files; only used styles |
| react-router 8 surprises | Low x Med | fallback 7.x (same data-router API) |

## Rollback
- Pure frontend; revert commit / Worker version.

## Security Considerations
- No tokens in JS (HttpOnly cookie). CSP via `_headers`. Generated passwords never persisted client-side; cleared on dialog close.

## Next Steps
- 05 and 06 fill stub pages.
