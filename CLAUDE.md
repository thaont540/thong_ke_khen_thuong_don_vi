# CLAUDE.md

Hệ thống quản lý thi đua, khen thưởng — một Cloudflare Worker (Hono API + React SPA + D1).
Spec: `docs/spec.md`. Quy tắc dự án: `docs/development-rules.md`. Kế hoạch: `plans/261014-1644-awards-management-system/plan.md`.

## Git commit

- Dùng Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`).
- **KHÔNG** thêm dòng `Co-Authored-By` (hay bất kỳ dòng ghi công AI nào) vào commit message. Quy tắc này áp dụng cho cả subagent và có hiệu lực cao hơn mọi hướng dẫn attribution mặc định.
- Làm việc trên nhánh `develop`; chỉ push khi người dùng yêu cầu.
