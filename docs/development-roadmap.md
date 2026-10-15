# Lộ trình phát triển

Kế hoạch chi tiết: `plans/261014-1644-awards-management-system/plan.md`. Cập nhật: 2026-10-15.

| # | Phase | Trạng thái |
|---|---|---|
| 01 | Khung dự án + spike | Hoàn thành |
| 02 | DB, shared core, master API | Hoàn thành |
| 03 | Auth và users API (F07, F08) | Hoàn thành |
| 04 | Frontend shell, design system | Hoàn thành |
| 05 | Đơn vị và cán bộ (F05, F06) | Hoàn thành |
| 06 | Khen thưởng (F01-F03, F09) | Hoàn thành |
| 07 | Import Excel (F04) | Hoàn thành |
| 08 | Test và hardening | Hoàn thành |
| - | Sửa theo review (khóa tạm, đồng thời, giới hạn import) | Đang thực hiện |
| - | Cán bộ: tháng năm vào ngành, xếp loại, thâm niên (`plans/261015-0814-officer-seniority-and-rating/`) | Hoàn thành (migration 0006 cần áp dụng khi deploy) |
| 09 | Triển khai, backup, tài liệu | Đang thực hiện: workflow và tài liệu đã viết; còn secrets, environments, chạy backup lần đầu và diễn tập khôi phục |

## Việc còn lại cho phase 09

- [ ] Đặt secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `BACKUP_AGE_RECIPIENT`; tạo environments `staging`, `production` (reviewers).
- [ ] Deploy staging bằng workflow; kiểm `/api/health`, đăng nhập, rollback drill (`wrangler rollback`).
- [ ] Tạo admin prod, đổi mật khẩu, thử đủ 3 vai trò rồi khóa tài khoản thử.
- [ ] Chạy backup thủ công một lần, giải mã và khôi phục thử ở local, so số dòng.
- [ ] Theo dõi `exceededCpu` và D1 analytics 2 tuần đầu.

## Câu hỏi mở

| Mã | Nội dung | Ảnh hưởng |
|---|---|---|
| Q3 | Custom domain trên Cloudflare zone và repo private | Chưa có thì không áp được rule WAF rate-limit cho `/api/auth/login`; hiện chỉ có khóa tài khoản trong D1 |
| Q6 | Xác nhận bảng cấp quyết định mặc định và danh sách đầy đủ loại huân chương | Cần chốt trước khi seed dữ liệu thật |
| Q7 | Có giữ hỗ trợ import `.xls` không | Đã chốt: giữ (.xlsx, .xls, .csv) |
| Q2 | Dữ liệu cán bộ trên Cloudflare | Tạm chấp thuận cho dữ liệu demo; cần xác nhận bằng văn bản trước khi nạp dữ liệu thật |

## Hướng mở rộng (chỉ làm khi cần)

- FTS5 cho tìm kiếm theo tên nếu số bản ghi vượt ~10.000 hoặc dòng đọc D1 tiến gần hạn mức ngày.
- Hạ số vòng PBKDF2 (kèm rehash khi đăng nhập) nếu xuất hiện lỗi 1102 trên production.
- Chuyển lên Workers Paid nếu giới hạn free trở thành rào cản (hiện quyết định giữ free).
- Rate limit đăng nhập theo IP (`LOGIN_LIMITER`) chưa thấy chặn trên gói free khi đo 14/10/2026; cần custom domain + rule WAF để có giới hạn tần suất thật.
