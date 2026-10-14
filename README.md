# Hệ thống quản lý thi đua, khen thưởng

Một Cloudflare Worker gồm API Hono, giao diện React và cơ sở dữ liệu D1. Quản lý khen thưởng tập thể và cá nhân, cán bộ, đơn vị, người dùng, import Excel.

## Bắt đầu nhanh

Yêu cầu: Node theo `.nvmrc` (24; tối thiểu 22.22).

```bash
npm ci
npm run db:migrate:local
npm run create-admin -- --username admin --name "Quản trị viên"   # in mật khẩu tạm một lần
npm run dev                      # http://localhost:5173
```

Đăng nhập bằng mật khẩu tạm, hệ thống bắt đổi mật khẩu ở lần đầu.

## Kiểm tra

```bash
npm run typecheck
npm run lint
npm run check:file-lines
npm test                         # worker + client
npx playwright install chromium  # lần đầu
npm run test:e2e
```

## Triển khai

`develop` tự deploy staging, `master` deploy production sau khi được duyệt (GitHub Actions). Deploy tay: `npm run deploy:staging` hoặc `npm run deploy:prod`. Xem `docs/deployment-guide.md`.

## Tài liệu

| File | Nội dung |
|---|---|
| `docs/spec.md` | Đặc tả nghiệp vụ (nguồn chính) |
| `docs/deployment-guide.md` | Dựng môi trường, deploy, secrets, WAF, giám sát |
| `docs/backup-and-restore-runbook.md` | Time Travel, khôi phục từ export, hoàn tác import |
| `docs/system-architecture.md` | Thành phần, luồng request, xác thực, dữ liệu, giới hạn D1 |
| `docs/code-standards.md` | Cấu trúc, đặt tên, test, quy tắc commit |
| `docs/development-rules.md` | Quy tắc dự án |
| `docs/project-changelog.md` | Nhật ký thay đổi |
| `docs/development-roadmap.md` | Lộ trình và việc còn mở |

Quy tắc commit: Conventional Commits, không có dòng `Co-Authored-By` (`CLAUDE.md`).
