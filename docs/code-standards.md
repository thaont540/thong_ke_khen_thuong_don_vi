# Quy chuẩn code

Bổ sung cho `development-rules.md` (nguồn chính cho quy tắc dự án) và `CLAUDE.md`.

## 1. Cấu trúc thư mục

```
src/worker/   API: routes/ (HTTP mỏng) -> services/ (nghiệp vụ, SQL) ; middleware/ lib/ db/ cron/ types/
src/client/   SPA: pages/<feature>/, components/, layout/, auth/, hooks/, lib/, styles/
src/shared/   Dùng chung FE/BE: schemas/ (Zod = hợp đồng API), import/, enum, quy tắc
migrations/   SQL thuần, đánh số 000N_ten.sql
scripts/      create-admin, check-file-lines, seed
test/         worker/ client/ shared/ ; e2e/ (Playwright)
```

Route chỉ parse request (Zod qua `parse-request.ts`), kiểm vai trò, gọi service. SQL và quy tắc nghiệp vụ nằm ở service. Schema Zod ở `shared/` là nguồn duy nhất cho kiểu request/response.

## 2. Đặt tên

- File: kebab-case, mô tả rõ mục đích (`award-import-batch-store.ts`, `use-award-form-save.ts`). Test: `<chủ-đề>.test.ts(x)`.
- Biến/hàm camelCase; kiểu/component/class PascalCase; hằng số UPPER_SNAKE (`MAX_FAILED_LOGINS`); cột và bảng SQL snake_case; trigger `trg_*`, index `ix_*`/`ux_*`.
- Hook React bắt đầu bằng `use`; query hook theo trang: `use-<feature>-queries.ts`.

## 3. Kích thước file

Mỗi file code/test <= **200 dòng** (kể cả test, e2e, scripts). `npm run check:file-lines` fail khi vượt, chạy trong CI. Tách theo chức năng thay vì nén code. Tài liệu trong `docs/` < 300 dòng mỗi file.

## 4. Công cụ

- Biome (`npm run lint`, `lint:fix`), TypeScript strict (`npm run typecheck` = `tsc -b`). Không để lỗi cú pháp/kiểu.
- Phiên bản dependency ghim cứng trong `package.json`; không dùng `^`.
- Sửa `wrangler.jsonc` xong chạy `npm run cf-typegen`. Không commit `.dev.vars` hay secret.

## 5. Cơ sở dữ liệu

- Migration và Drizzle schema (`src/worker/db/schema/`) đổi **trong cùng PR**. Drizzle chỉ để query có kiểu, không dùng drizzle-kit.
- Migration không sửa sau khi merge; thay đổi mới = file mới. Không `BEGIN/COMMIT`. Chỉ thêm (additive) để bản Worker cũ vẫn chạy được lúc rollback.
- Nhiều câu lệnh ghi dùng `db.batch()`; bất biến đặt trong SQL (trigger, `UPDATE` có điều kiện + kiểm `meta.changes`).
- Tối đa 100 tham số bind mỗi câu: chia nhỏ insert và `IN (...)`.

## 6. Test

| Loại | Công cụ | Lệnh |
|---|---|---|
| Worker + shared | Vitest 4 + `@cloudflare/vitest-plugin` (workerd, D1 thật in-memory) | `npm run test:worker` |
| Client | Vitest + jsdom + Testing Library | `npm run test:client` |
| E2E | Playwright, build production + `vite preview` | `npm run test:e2e` |

- Test worker dùng D1 thật đã áp migration (`test/worker/apply-migrations-setup.ts`), không mock DB. Mỗi test dọn dữ liệu bằng `resetTestData` (`test/worker/helpers/test-fixtures.ts`): xóa bảng con trước (`awards`, `import_batches`, `officers`, `audit_logs`, `sessions`, `users`, và đội/đơn vị id >= 900); danh mục seed được giữ. `award_counters` do trigger cập nhật nên xóa `awards` sẽ giảm theo.
- E2E dùng DB local riêng (`E2E_STATE_DIR`), một worker, mỗi spec tự reset trong `beforeEach`.
- Mỗi quyền mới thêm vào ma trận RBAC test; mỗi trigger/migration mới thêm test ở `migrations-and-triggers.test.ts` (hoặc file riêng).
- Không bỏ qua test lỗi để qua CI.

## 7. Git và commit

- Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- **Không** thêm dòng `Co-Authored-By` hay ghi công AI vào commit message (`CLAUDE.md`).
- Làm trên `develop`; chỉ push khi được yêu cầu. Trước khi push: `npm run lint`, `npm run typecheck`, `npm test`.
- `develop` tự deploy staging; production qua `main` + duyệt (xem `deployment-guide.md`).
