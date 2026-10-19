# Clarifications

## Session 2026-10-19
- Q: Import cá nhân xác định cán bộ thế nào (bỏ cột Mã cán bộ)? → A: Khớp theo họ tên + đơn vị (+ đội nếu có); chưa có thì tự tạo cán bộ từ họ tên, cấp bậc, chức vụ (năm sinh, số hiệu để trống); trùng nhiều người thì báo lỗi dòng.
- Q: Xếp loại cán bộ trong file mẫu lưu thế nào? → A: Thành bản ghi theo năm (hình thức thứ 3 "Xếp loại cán bộ", chỉ cá nhân); xếp loại hiện tại ở F05 lấy theo năm gần nhất; mỗi cán bộ mỗi năm tối đa 1 xếp loại.
- Q: Cục CSGT làm tới mức nào? → A: Đơn vị loại Cục, đứng đầu danh sách; thêm chức vụ Cục trưởng, Phó Cục trưởng và cấp quyết định "Cục trưởng Cục CSGT"; không đổi cách lọc (không có cây cha-con).
- Q: Lưu file văn bản quy định ở đâu? → A: Cloudflare R2 (người dùng bật R2 trên dashboard). Đã thay bằng mục Workers KV bên dưới.
- Q: Ai quản lý văn bản quy định? → A: Quản trị và Biên tập thêm/sửa/xóa; mọi vai trò xem và tải về.
- Q: Thông tin văn bản? → A: Đầy đủ: số hiệu, trích yếu, loại, cơ quan ban hành, ngày ban hành, hiệu lực, ghi chú, file PDF/DOC/DOCX/XLS/XLSX tối đa 20 MB; tìm theo số hiệu/trích yếu, lọc theo loại và hiệu lực.

## Session 2026-10-19 (b)
- Q: Lưu file khi không bật R2? → A: Workers KV (không cần thẻ)
