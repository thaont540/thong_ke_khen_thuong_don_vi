# Hướng dẫn triển khai

Một Cloudflare Worker (Hono API + React SPA + D1), gói **free**. Hai môi trường:

| Môi trường | Worker | D1 | URL |
|---|---|---|---|
| staging | `app-nghia-staging` | `app-nghia-staging` (`f9bcb8d3-e69e-421b-a96a-e7baa4971492`) | https://app-nghia-staging.mail-rac-289.workers.dev |
| production | `app-nghia` | `app-nghia` (`6c30470a-011c-4130-bf04-cd53240f30ff`) | https://app-nghia.mail-rac-289.workers.dev |

Account id: `73f25c30ebdac673580327d9385d6ca6`. Cấu hình ở `wrangler.jsonc` (staging là `env.staging`).

## 1. Dựng từ đầu

1. Cài Node theo `.nvmrc` (24; `engines` >= 22.22), rồi `npm ci`.
2. `npx wrangler login` (hoặc đặt `CLOUDFLARE_API_TOKEN`).
3. Tạo D1 (chỉ khi dựng account mới):
   ```bash
   npx wrangler d1 create app-nghia
   npx wrangler d1 create app-nghia-staging
   ```
   Chép `database_id` vào `wrangler.jsonc`, rồi `npm run cf-typegen`.
   Tệp văn bản quy định lưu ở Workers KV (không cần R2, không cần thẻ). Namespace đã tạo: production `app-nghia-docs` (id `0843798cc27241ba8a7a0898e4e6b50e`), staging `app-nghia-docs-staging` (id `688dc9454b9d4222b9be891b451ad1e3`), đã khai báo trong `kv_namespaces` của `wrangler.jsonc`. Dựng account mới thì tạo lại và thay id:
   ```bash
   npx wrangler kv namespace create app-nghia-docs
   npx wrangler kv namespace create app-nghia-docs-staging
   ```
4. Áp migration (thứ tự 0001 -> 0004, tự chạy theo số thứ tự):
   ```bash
   npm run db:migrate:staging
   npm run db:migrate:prod
   ```
5. Tạo admin đầu tiên cho từng môi trường (xem mục 3).
6. Deploy (mục 4 hoặc 5).

## 2. Chạy local

```bash
npm ci
npm run db:migrate:local        # D1 local trong .wrangler/state
npm run create-admin -- --username admin --name "Quản trị viên"   # --env local mặc định
npm run dev                     # vite + workerd, http://localhost:5173
```

`.dev.vars` (gitignored) hiện không cần secret nào. Cron chạy tay: `curl "localhost:5173/cdn-cgi/local/scheduled?cron=0+17+*+*+*"`.
Kiểm tra: `npm run typecheck && npm run lint && npm run check:file-lines && npm test`; e2e: `npx playwright install chromium && npm run test:e2e`.

## 3. Tạo admin theo môi trường

```bash
npm run create-admin -- --username admin --name "Quản trị viên" --env staging
npm run create-admin -- --username admin --name "Quản trị viên" --env prod
```

- Cần đã `wrangler login` / có token; script ghi qua `wrangler d1 execute` (file SQL tạm, xóa sau khi chạy).
- Mật khẩu tạm in **một lần** ra terminal; người dùng phải đổi ở lần đăng nhập đầu (`must_change_password = 1`).
- Trùng username thì lỗi, không ghi đè. Quên mật khẩu: admin khác dùng "Đặt lại mật khẩu" ở trang Người dùng.
- Sau khi dựng prod: đăng nhập admin, đổi mật khẩu, tạo thử EDITOR/VIEWER để kiểm tra, rồi khóa tài khoản thử.

## 4. Deploy thủ công

```bash
npm run deploy:staging   # CLOUDFLARE_ENV=staging vite build -> migrations staging -> wrangler deploy
npm run deploy:prod      # vite build -> migrations prod -> wrangler deploy
```

Thứ tự luôn là build -> **migration trước** -> deploy. Migration chỉ được **thêm** (không đổi/xóa cột bản Worker cũ còn dùng) để rollback code an toàn.
Rollback code: `npx wrangler rollback` (thêm `--env staging` cho staging). Rollback dữ liệu: xem `backup-and-restore-runbook.md`.

## 5. Deploy bằng GitHub Actions

`.github/workflows/deploy.yml`: job `check` (typecheck, lint, test) rồi:

| Sự kiện | Kết quả |
|---|---|
| push `develop` | deploy staging (environment `staging`) |
| push `master` | deploy production (environment `production`, chờ reviewer duyệt) |
| Run workflow, chọn `target` | staging (từ nhánh bất kỳ) hoặc production (**chỉ chạy khi ref là `master`**) |

Mỗi môi trường có nhóm concurrency riêng (`deploy-staging`, `deploy-production`, không hủy lượt đang chạy). `CLOUDFLARE_*` chỉ được gắn vào job deploy, không có trong job `check`. Thiếu secret thì job deploy in `::warning::` và bỏ qua các bước deploy (workflow xanh nhưng có cảnh báo).

Mỗi job deploy kết thúc bằng smoke test `GET /api/health`. CI chung (`ci.yml`) vẫn chạy trên mọi push/PR.

### Secrets và environments (làm một lần trên GitHub)

| Secret | Nội dung |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token giới hạn account: Workers Scripts:Edit, D1:Edit. Xoay vòng mỗi năm |
| `CLOUDFLARE_ACCOUNT_ID` | `73f25c30ebdac673580327d9385d6ca6` |
| `BACKUP_AGE_RECIPIENT` | Khóa **công khai** age (`age1...`) để mã hóa backup |

**Đặt `CLOUDFLARE_API_TOKEN` và `CLOUDFLARE_ACCOUNT_ID` là Environment secrets** (Settings > Environments > `staging` / `production`), không đặt ở repo-level; token staging chỉ cần quyền trên D1/Worker staging. `BACKUP_AGE_RECIPIENT` và token backup đặt ở repo secrets (workflow backup không dùng environment). Settings > Environments: tạo `staging` (không rào) và `production` với **Required reviewers** và **Deployment branches = master**. Repo phải để private. Khóa riêng age do quản trị đơn vị giữ offline, không đưa lên GitHub.

Sinh khóa age: `age-keygen -o age-backup.key` (in ra dòng `Public key: age1...`).

## 6. Sao lưu

`.github/workflows/backup-d1-weekly.yml` chạy Chủ nhật 18:00 UTC (và chạy tay được): export D1 prod -> gzip -> mã hóa age -> artifact 90 ngày. Không có artifact plaintext. Workflow lỗi thì GitHub gửi email. Chi tiết khôi phục: `backup-and-restore-runbook.md`.

## 7. Giám sát CPU và D1

- Workers Logs bật sẵn (`observability.enabled`). Theo dõi `outcome = exceededCpu` (lỗi 1102) trên `/api/auth/login` và `/api/auth/change-password`.
- PBKDF2 giữ **100000** vòng trên gói free (spike 2026-10-14: p95 ~72ms CPU, 60/60 request song song OK, không 1102; xem `plans/reports/spike-261014-results.md`). Số vòng lưu trong chuỗi hash nên có thể hạ sau này mà không phải đặt lại mật khẩu; nếu thấy 1102 thì hạ (ví dụ 20000) và rehash khi đăng nhập.
- D1 free: 5 triệu dòng đọc, 100 nghìn dòng ghi mỗi ngày. Xem D1 analytics hằng tuần trong tháng đầu.

## 8. Custom domain và WAF (làm khi có domain, câu hỏi mở Q3)

Hiện chưa có domain: không áp được rule WAF trên `*.workers.dev`. Biện pháp chống dò mật khẩu hiện tại: (1) khóa tài khoản trong D1 (5 lần sai -> khóa 15 phút, `login-attempt-guard.ts`; thử trong lúc khóa không kéo dài khóa và không lộ tài khoản đang khóa), (2) giới hạn 10 request/60s theo IP bằng Workers Rate Limiting binding `LOGIN_LIMITER` (`ratelimits` trong `wrangler.jsonc`, namespace_id `1001` prod / `1002` staging; trả 429). **Đo thực tế 14/10/2026 trên staging (gói free, `*.workers.dev`): 40 request liên tiếp cùng IP đều không bị 429** — binding chạy không lỗi nhưng chưa chặn (Cloudflare mô tả binding là "permissive, eventually consistent"; chưa rõ gói free có áp dụng). Coi đây là lớp phụ, không dựa vào nó; lớp chính là khóa tài khoản, và rule WAF khi có domain. Binding không cần domain. Nếu bị khóa mất Quản trị duy nhất: `npm run create-admin` (break-glass).

Khi có domain trên Cloudflare zone:
1. Thêm route/custom domain cho Worker trong `wrangler.jsonc` (`routes` với `custom_domain: true`), `npm run cf-typegen`, deploy.
2. Bật "Always Use HTTPS" cho zone.
3. Security > WAF > Rate limiting rules (free: 1 rule): `http.request.uri.path eq "/api/auth/login" and http.request.method eq "POST"`, 10 request / 10 giây theo IP, hành động Block 10 giây.
4. Kiểm tra: bắn >10 request liên tiếp, kỳ vọng bị chặn (429); tắt rule ở dashboard nếu gây lỗi.
5. Cập nhật mục này và `development-roadmap.md`.

## 9. Giới hạn nên nhớ

Văn bản quy định: mỗi tệp tối đa 20 MB (KV tối đa 25 MiB mỗi giá trị); KV free tối đa 1.000 lượt ghi mỗi ngày và nhất quán cuối cùng (tệp mới có thể mất tới ~60 giây mới tải về được, API trả 404 kèm thông báo thử lại). Import Excel: 5 MB, 100 dòng mỗi file, mỗi lô gửi 30 dòng. Body API tối đa 256 KB (login/đổi mật khẩu 5 KB). Phiên đăng nhập 8 giờ, cron dọn phiên 17:00 UTC hằng ngày.
