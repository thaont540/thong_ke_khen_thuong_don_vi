# Spec hệ thống quản lý thi đua, khen thưởng

Oct 14, 2026 · @Thao

## 1. Tổng quan

Hệ thống web giúp đơn vị lưu và tra cứu danh hiệu thi đua, hình thức khen thưởng của tập thể và cá nhân, thay cho sổ sách và file Excel rời. Người dùng là 3–5 cán bộ phụ trách công tác thi đua. Tài liệu này mô tả 6 chức năng đã có trong mockup, thiết kế cơ sở dữ liệu và dữ liệu danh mục ban đầu.

### Phạm vi

| Mã | Chức năng | Màn hình trong mockup |
| --- | --- | --- |
| F01 | Danh sách danh hiệu, khen thưởng | Danh hiệu, khen thưởng |
| F02 | Xem chi tiết cán bộ và quá trình khen thưởng | Modal khi bấm tên cán bộ |
| F03 | Thêm khen thưởng thủ công | Thêm khen thưởng, tab Nhập thủ công |
| F04 | Import khen thưởng từ Excel | Thêm khen thưởng, tab Import từ Excel |
| F05 | Quản lý cán bộ (thêm, sửa, xóa, xem) | Quản lý cán bộ |
| F06 | Quản lý đơn vị và đội (thêm, sửa, xóa, xem) | Quản lý đơn vị |
| F07 | Đăng nhập, đổi mật khẩu, đăng xuất | Chưa có trong mockup |
| F08 | Quản lý người dùng và vai trò | Chưa có trong mockup |
| F09 | Sửa, xóa bản ghi khen thưởng | Nút Sửa, Xóa trên từng dòng của F01 |

Ngoài phạm vi đợt này: quy trình đề nghị và xét duyệt hồ sơ khen thưởng, đăng ký thi đua đầu năm, báo cáo thống kê xuất file.

### Vai trò và phân quyền

Hệ thống có 3 vai trò, lưu ở cột role của bảng users và do Quản trị gán qua F08. Mỗi người dùng có đúng một vai trò.

| Chức năng | Quản trị (ADMIN) | Biên tập (EDITOR) | Xem (VIEWER) |
| --- | --- | --- | --- |
| F01 Danh sách danh hiệu, khen thưởng | Xem | Xem | Xem |
| F02 Chi tiết cán bộ | Xem; có nút Thêm khen thưởng và Sửa thông tin | Xem; có nút Thêm khen thưởng | Chỉ xem |
| F03 Thêm khen thưởng thủ công | Có | Có | Không |
| F04 Import từ Excel | Có | Có | Không |
| F09 Sửa, xóa khen thưởng | Có | Có | Không |
| F05 Quản lý cán bộ | Thêm, sửa, xóa, xem | Không | Không |
| F06 Quản lý đơn vị và đội | Thêm, sửa, xóa, xem | Không | Không |
| F07 Đăng nhập, đổi mật khẩu, đăng xuất | Có | Có | Có |
| F08 Quản lý người dùng | Có | Không | Không |

- Menu chỉ hiện các màn hình vai trò được phép. Vai trò Xem chỉ thấy Danh hiệu, khen thưởng; Biên tập thấy thêm Thêm khen thưởng.
- Mở thẳng đường dẫn của màn hình không được phép: chuyển về F01 và báo "Bạn không có quyền truy cập chức năng này".
- Giao diện chỉ ẩn nút cho gọn; quyền thật sự do API kiểm tra, sai quyền trả 403 (mục 9).
- Biên tập không có màn hình F05, F06 nhưng vẫn được đọc danh mục đơn vị, đội và danh sách cán bộ rút gọn qua API, để chọn được cán bộ ở F03 và kiểm tra mã cán bộ khi import ở F04.

### Thuật ngữ

| Thuật ngữ | Nghĩa trong hệ thống |
| --- | --- |
| Đơn vị | Cấp phòng hoặc thủy đoàn: Phòng 1–8, Thủy đoàn I, Thủy đoàn II |
| Đội | Cấp đội trực thuộc một đơn vị; hiện chỉ Phòng 6 (11 đội) và Phòng 7 (2 đội) có đội |
| Đối tượng | Tập thể hoặc Cá nhân được khen |
| Hình thức | Danh hiệu (danh hiệu thi đua) hoặc Khen thưởng (hình thức khen thưởng) |
| Cấp quyết định | Người hoặc cơ quan ký quyết định khen, ví dụ Bộ trưởng Bộ Công an |

## 2. Quy tắc nghiệp vụ chung

Danh hiệu được tách theo đối tượng, còn bốn hình thức khen thưởng áp dụng chung cho cả tập thể và cá nhân. Mọi màn hình có chọn danh hiệu hoặc khen thưởng (F01, F03, F04) đều dùng chung ma trận dưới đây.

| Đối tượng | Hình thức | Giá trị hợp lệ |
| --- | --- | --- |
| Tập thể | Danh hiệu | Cờ Thi đua của Chính phủ; Cờ thi đua của Bộ Công an; Đơn vị quyết thắng; Đơn vị tiên tiến |
| Cá nhân | Danh hiệu | Chiến sĩ thi đua toàn quốc; Chiến sĩ thi đua toàn lực lượng; Chiến sĩ thi đua cơ sở; Chiến sĩ tiên tiến |
| Tập thể, Cá nhân | Khen thưởng | Huân chương (bắt buộc chọn loại huân chương); Bằng khen Thủ tướng Chính phủ; Bằng khen Bộ Công an; Giấy khen |

### Cấp quyết định mặc định

Khi chọn danh hiệu hoặc khen thưởng, hệ thống tự điền cấp quyết định, người dùng có thể đổi. Bảng này là giả định dùng khi làm mockup, cần nghiệp vụ xác nhận.

| Danh hiệu / khen thưởng | Cấp quyết định mặc định |
| --- | --- |
| Huân chương | Chủ tịch nước |
| Cờ Thi đua của Chính phủ; Chiến sĩ thi đua toàn quốc; Bằng khen Thủ tướng Chính phủ | Thủ tướng Chính phủ |
| Cờ thi đua của Bộ Công an; Chiến sĩ thi đua toàn lực lượng; Bằng khen Bộ Công an | Bộ trưởng Bộ Công an |
| Đơn vị quyết thắng; Đơn vị tiên tiến; Chiến sĩ thi đua cơ sở; Chiến sĩ tiên tiến; Giấy khen | Thủ trưởng đơn vị |

### Quy tắc

| Mã | Quy tắc |
| --- | --- |
| BR-01 | Khen tập thể gắn với một đơn vị (khen cả đơn vị) hoặc một đội cụ thể của đơn vị đó. Danh hiệu Đơn vị quyết thắng và Đơn vị tiên tiến được xét cho cả cấp đơn vị và cấp đội. |
| BR-02 | Khen cá nhân gắn với một cán bộ. Đơn vị và đội của bản ghi được lưu theo đơn vị của cán bộ tại thời điểm khen; cán bộ chuyển đơn vị sau đó không làm đổi lịch sử. Khi sửa bản ghi mà giữ nguyên cán bộ thì giữ nguyên đơn vị và đội đã lưu. |
| BR-03 | Đơn vị không có đội thì trường Đội bị khóa ở giá trị mặc định trên mọi màn hình. |
| BR-04 | Không được xóa đơn vị hoặc đội khi vẫn còn cán bộ hoặc bản ghi khen thưởng gắn với nó. |
| BR-05 | Xóa cán bộ thì các bản ghi khen thưởng của cán bộ đó bị xóa theo. Bản chạy thật dùng xóa mềm (đánh dấu deleted\_at) để có thể khôi phục; xóa bản ghi khen thưởng (F09) cũng là xóa mềm. |
| BR-06 | Số hiệu cán bộ gồm đúng 6 chữ số và không trùng. Mã và tên đơn vị không trùng. Tên đội không trùng trong cùng một đơn vị. |
| BR-07 | So khớp tên khi tìm kiếm và import: không phân biệt hoa thường, bỏ khoảng trắng thừa, chuẩn hóa Unicode NFC. |
| BR-08 | Cảnh báo trùng khi đã có bản ghi chưa xóa cùng đối tượng, cùng danh hiệu hoặc khen thưởng (với huân chương là cùng loại) và cùng năm. Cùng đối tượng nghĩa là: cá nhân cùng cán bộ; tập thể cùng đơn vị và cùng đội (hoặc cùng là cấp đơn vị). Đây là cảnh báo, không chặn: người dùng xác nhận thì vẫn lưu được. |

## 3. F01 Danh sách danh hiệu, khen thưởng và F02 Chi tiết cán bộ

### F01 Danh sách

Màn hình mặc định khi đăng nhập. Hiển thị mọi bản ghi khen thưởng, lọc được theo đơn vị, đội, đối tượng và hình thức.

**Bộ lọc** (đổi bất kỳ bộ lọc nào thì quay về trang 1)

| Bộ lọc | Giá trị | Quy tắc |
| --- | --- | --- |
| Đơn vị | Tất cả; danh sách đơn vị theo thứ tự sắp xếp | Đổi đơn vị thì nạp lại danh sách đội |
| Đội | Tất cả; các đội của đơn vị đang chọn | Đơn vị là Tất cả: hiện toàn bộ đội. Đơn vị không có đội: khóa ở Tất cả (BR-03) |
| Đối tượng | Tất cả; Tập thể; Cá nhân |  |
| Hình thức | Tất cả; Danh hiệu; Khen thưởng |  |
| Tìm kiếm | Ô nhập tự do | Khớp một phần với tên tập thể, tên cán bộ hoặc số quyết định (BR-07) |

Nút **Xóa bộ lọc** đưa mọi bộ lọc về Tất cả và xóa ô tìm kiếm.

**Dòng thống kê** trên bảng hiển thị theo kết quả lọc: tổng số bản ghi, số danh hiệu, số khen thưởng, số tập thể, số cá nhân.

**Bảng kết quả**

| Cột | Nội dung |
| --- | --- |
| STT | Số thứ tự liên tục qua các trang |
| Năm | Năm khen thưởng |
| Tập thể / cá nhân | Dòng chính: tên cán bộ, tên đội hoặc tên đơn vị. Dòng phụ: với cá nhân là cấp bậc, đơn vị / đội; với tập thể cấp đội là đơn vị / đội; với tập thể cấp đơn vị là "Cấp đơn vị" |
| Đối tượng | Nhãn Tập thể hoặc Cá nhân |
| Hình thức | Nhãn Danh hiệu hoặc Khen thưởng |
| Danh hiệu / khen thưởng | Tên danh hiệu hoặc khen thưởng (với huân chương là tên loại); dòng phụ là cấp quyết định |
| Quyết định | Số quyết định và ngày quyết định (dd/mm/yyyy) |

- Cột cuối cùng là nút **Sửa** và **Xóa** của từng bản ghi (F09), chỉ hiện với Quản trị và Biên tập.
- Sắp xếp: năm giảm dần, sau đó bản ghi mới tạo lên trước.
- Phân trang 10 dòng mỗi trang; hiện "Hiển thị a–b trong N" và các nút trang.
- Không có kết quả: hiện thông báo kèm nút Xóa bộ lọc.
- Tên cá nhân là liên kết mở F02. Tên tập thể không bấm được.

### F02 Modal chi tiết cán bộ

Mở từ F01 (bấm tên cán bộ) hoặc từ F05 (bấm tên hoặc nút Xem). Đầu modal hiện chữ cái viết tắt, họ tên, cấp bậc và chức vụ.

| Phần | Nội dung |
| --- | --- |
| Thông tin cán bộ | Họ tên, năm sinh, số hiệu, cấp bậc, chức vụ, mã cán bộ, tháng năm vào ngành (mm/yyyy), thâm niên ("N năm"), xếp loại, đơn vị / đội. Chưa có dữ liệu hiện "—" |
| Khen thưởng đang xem | Chỉ hiện khi mở từ F01: hình thức, năm, cấp quyết định, danh hiệu thi đua, hình thức khen thưởng, số và ngày quyết định, chi tiết giải thưởng, ghi chú. Trường không áp dụng hiện "—" |
| Quá trình thi đua, khen thưởng | Mọi bản ghi của cán bộ, năm giảm dần; dòng đang xem được tô nổi bật. Không có bản ghi thì hiện "Cán bộ này chưa có khen thưởng nào" |

- **Thêm khen thưởng**: đóng modal, mở F03 với đối tượng Cá nhân, đơn vị, đội và cán bộ đã chọn sẵn.
- **Sửa thông tin**: đóng modal, mở form sửa cán bộ của F05.
- Đóng modal bằng nút ×, nút Đóng, phím Esc hoặc bấm ra vùng nền.

Nút **Thêm khen thưởng** chỉ hiện với Quản trị và Biên tập; nút **Sửa thông tin** chỉ hiện với Quản trị. Với vai trò Xem, modal chỉ có nút Đóng.

## 4. F03 Thêm khen thưởng thủ công và F09 Sửa, xóa khen thưởng

Nhập từng bản ghi khen thưởng qua một form chia 4 nhóm. Danh sách lựa chọn thay đổi theo đối tượng, hình thức và đơn vị đang chọn.

### Trường dữ liệu

| Nhóm | Trường | Kiểu | Bắt buộc | Quy tắc |
| --- | --- | --- | --- | --- |
| Đối tượng được khen | Đối tượng | Chọn 1: Cá nhân, Tập thể | Có | Mặc định Cá nhân |
|  | Đơn vị | Danh sách | Có | Danh sách đơn vị |
|  | Đội | Danh sách | Không | Tập thể: mục đầu là "Khen cho cả đơn vị" (không chọn đội). Cá nhân: mục đầu là "Tất cả đội", chỉ dùng để lọc cán bộ. Khóa khi đơn vị không có đội |
|  | Cán bộ | Danh sách | Có, khi Cá nhân | Chỉ hiện khi Cá nhân. Gồm cán bộ thuộc đơn vị và đội đang chọn, dạng "Họ tên (cấp bậc, số hiệu)". Khóa khi chưa chọn đơn vị |
|  | Thông tin cán bộ | Chỉ đọc |  | Họ tên, năm sinh, cấp bậc, chức vụ, đơn vị / đội và thâm niên của cán bộ đã chọn |
| Danh hiệu, khen thưởng | Hình thức | Chọn 1: Danh hiệu, Khen thưởng | Có | Mặc định Danh hiệu |
|  | Danh hiệu thi đua / Hình thức khen thưởng | Danh sách | Có | Tên nhãn và giá trị đổi theo ma trận ở mục 2 |
|  | Loại huân chương | Danh sách | Có, khi chọn Huân chương | Chỉ hiện khi chọn Huân chương |
| Quyết định khen thưởng | Năm khen thưởng | Số | Có | 1990–2100, mặc định năm hiện tại |
|  | Số quyết định | Văn bản | Có | Tối đa 50 ký tự |
|  | Ngày quyết định | Ngày | Có |  |
|  | Cấp quyết định | Danh sách | Có | Tự chọn theo bảng mặc định ở mục 2, người dùng đổi được |
| Chi tiết giải thưởng | Thành tích, nội dung khen thưởng | Văn bản nhiều dòng | Có | Tối đa 2.000 ký tự |
|  | Ghi chú | Văn bản | Không | Tối đa 500 ký tự |

Mockup đang để Cấp quyết định là ô nhập tự do. Bản chạy thật đổi thành danh sách chọn từ danh mục để thống kê được theo cấp.

### Hành vi

- Đổi Đối tượng hoặc Hình thức: nạp lại danh sách danh hiệu / khen thưởng; giữ giá trị đang chọn nếu vẫn hợp lệ, ngược lại để trống.
- Đổi Đơn vị hoặc Đội: nạp lại danh sách cán bộ; bỏ chọn cán bộ nếu người đó không thuộc phạm vi mới.
- Bản ghi cá nhân lưu đơn vị và đội theo cán bộ (BR-02), không theo giá trị bộ lọc Đội.
- Bấm lưu: kiểm tra mọi trường bắt buộc, hiện lỗi ngay dưới từng trường và đưa con trỏ tới trường lỗi đầu tiên.

### Nút thao tác

| Nút | Kết quả |
| --- | --- |
| Lưu khen thưởng | Lưu, hiện thông báo "Đã lưu khen thưởng cho …", xóa form, về F01 với bộ lọc mặc định |
| Lưu và thêm tiếp | Lưu, giữ nguyên mọi trường trừ Cán bộ để nhập người tiếp theo cùng quyết định |
| Xóa nội dung | Đưa form về trạng thái ban đầu, không lưu |

### Cảnh báo trùng

Khi bấm lưu (thêm mới hoặc sửa) và dữ liệu đã qua kiểm tra trường, hệ thống tìm bản ghi trùng theo BR-08. Khi sửa, bản ghi đang sửa không tính là trùng với chính nó.

- Có trùng: hiện hộp thoại "Có thể bị trùng" với nội dung "… đã có … năm … (quyết định …). Bạn vẫn muốn lưu?", liệt kê số quyết định của các bản ghi trùng.
- Bấm **Vẫn lưu**: lưu bình thường. Bấm **Hủy**: quay lại form, giữ nguyên dữ liệu đã nhập.
- Không trùng: lưu ngay, không hỏi.

### F09 Sửa, xóa khen thưởng

Dành cho Quản trị và Biên tập, thực hiện từ nút Sửa, Xóa trên từng dòng của F01.

**Sửa**

- Mở lại form của F03 với tiêu đề "Sửa khen thưởng" và dòng thông báo "Đang sửa bản ghi …: … năm … của …". Ẩn tab Import, nút Lưu và thêm tiếp và nút Xóa nội dung.
- Mọi trường được điền sẵn theo bản ghi, kể cả đối tượng, hình thức và loại huân chương; mọi trường đều sửa được với cùng quy tắc kiểm tra như khi thêm.
- Nút **Lưu thay đổi**: kiểm tra, cảnh báo trùng, lưu, hiện "Đã cập nhật khen thưởng của …" rồi về F01, giữ nguyên bộ lọc. Nút **Hủy**: về F01, không lưu.
- Rời màn hình bằng menu cũng là hủy sửa.
- Giữ nguyên cán bộ thì giữ đơn vị, đội đã lưu; đổi sang cán bộ khác thì lấy đơn vị, đội hiện tại của cán bộ mới (BR-02).
- Ghi audit\_logs với giá trị trước và sau khi sửa.

**Xóa**

- Hộp xác nhận nêu tên danh hiệu hoặc khen thưởng, năm, tên tập thể hoặc cá nhân và số quyết định.
- Xác nhận thì xóa mềm (BR-05), hiện "Đã xóa khen thưởng của …" và làm mới danh sách, giữ trang hiện tại.
- Khôi phục bản ghi đã xóa mềm không có trên giao diện; Quản trị xử lý trực tiếp trong database khi cần.

## 5. F04 Import khen thưởng từ Excel

Nhập nhiều bản ghi cùng lúc từ một file. Hệ thống kiểm tra từng dòng trước, chỉ nhập các dòng hợp lệ; dòng lỗi được báo rõ lý do để sửa trong file rồi tải lên lại.

### Luồng thao tác

1. Người dùng bấm **Tải file mẫu (.xlsx)**.
2. Người dùng điền mỗi dòng một khen thưởng vào sheet đầu tiên.
3. Người dùng kéo thả file vào vùng tải lên hoặc bấm để chọn file (.xlsx, .xls, .csv; tối đa 5 MB, 100 dòng).
4. Hệ thống đọc sheet đầu tiên, bỏ qua dòng trống, kiểm tra từng dòng và hiện bảng xem trước.
5. Người dùng bấm **Nhập N dòng hợp lệ**, hoặc **Chọn file khác** để làm lại.
6. Hệ thống lưu các dòng hợp lệ trong cùng một đợt import, hiện "Đã nhập N khen thưởng" và về F01.

### File mẫu

Sheet **Khen thưởng** có dòng tiêu đề và 3 dòng ví dụ. Sheet **Danh mục** liệt kê giá trị hợp lệ: đối tượng, hình thức, danh hiệu tập thể, danh hiệu cá nhân, hình thức khen thưởng (gồm các loại huân chương), đơn vị, đội theo dạng "Đơn vị: Đội", mã cán bộ và họ tên.

| Cột | Bắt buộc | Ví dụ | Quy tắc |
| --- | --- | --- | --- |
| Đối tượng | Có | Cá nhân | Tập thể hoặc Cá nhân |
| Mã cán bộ | Có, khi Cá nhân | CB001 | Phải tồn tại; để trống khi Tập thể |
| Đơn vị | Có | Phòng 6 | Khớp tên hoặc mã đơn vị |
| Đội | Không | Đội Dẫn đoàn số 1 | Phải thuộc đơn vị ở cột Đơn vị |
| Hình thức | Có | Danh hiệu | Danh hiệu hoặc Khen thưởng |
| Danh hiệu / khen thưởng | Có | Chiến sĩ thi đua cơ sở | Hợp lệ theo ma trận mục 2. Với huân chương ghi đúng tên loại, ví dụ Huân chương Chiến công hạng Ba |
| Năm | Có | 2026 | Số nguyên 1990–2100 |
| Số quyết định | Có | 125/QĐ-ĐV |  |
| Ngày quyết định | Có | 15/09/2026 | dd/mm/yyyy, yyyy-mm-dd hoặc ô kiểu ngày của Excel |
| Cấp quyết định | Không | Bộ trưởng Bộ Công an | Để trống thì lấy mặc định theo mục 2 |
| Chi tiết giải thưởng | Có | Hoàn thành xuất sắc nhiệm vụ năm 2026 |  |
| Ghi chú | Không |  |  |

### Kiểm tra và thông báo lỗi

Thiếu một cột bắt buộc thì từ chối cả file và liệt kê tên các cột thiếu. Các lỗi theo dòng:

| Kiểm tra | Thông báo |
| --- | --- |
| Đối tượng sai giá trị | Đối tượng phải là Tập thể hoặc Cá nhân |
| Đơn vị không tồn tại | Không tìm thấy đơn vị "…" |
| Đội không thuộc đơn vị | Đội "…" không thuộc … |
| Cá nhân thiếu mã | Cá nhân cần có mã cán bộ |
| Mã cán bộ không tồn tại | Không tìm thấy cán bộ mã … |
| Cán bộ khác đơn vị hoặc đội | Cán bộ … không thuộc … |
| Hình thức sai giá trị | Hình thức phải là Danh hiệu hoặc Khen thưởng |
| Danh hiệu sai đối tượng hoặc hình thức | "…" không phải danh hiệu tập thể / danh hiệu cá nhân / hình thức khen thưởng hợp lệ |
| Huân chương ghi thiếu loại | Ghi rõ loại huân chương, ví dụ Huân chương Chiến công hạng Ba |
| Năm, số QĐ, ngày QĐ, chi tiết | Năm không hợp lệ / Thiếu số quyết định / Ngày quyết định phải theo dạng dd/mm/yyyy / Thiếu chi tiết giải thưởng |

Bảng xem trước gồm: số dòng trong file, trạng thái (Hợp lệ / Lỗi), tên tập thể hoặc cá nhân, đối tượng, danh hiệu / khen thưởng, năm, số quyết định và danh sách lỗi. Dòng lỗi được tô màu.

**Cảnh báo trùng khi import:** dòng hợp lệ còn được kiểm tra trùng theo BR-08, với dữ liệu đã có ("Trùng với bản ghi đã có (quyết định …)") và với các dòng phía trên trong cùng file ("Trùng với dòng … trong file"). Dòng trùng có trạng thái "Có thể trùng", tô màu vàng, mặc định không được nhập. Người dùng tích ô **Nhập cả N dòng có thể trùng** thì các dòng này được nhập cùng; nút nhập hiện đúng số dòng sẽ nhập.

### Giới hạn

- Mỗi file tối đa **5 MB** và tối đa **100 dòng dữ liệu** (không tính dòng tiêu đề và dòng trống). Đã chốt ngày 14/10/2026.
- Vượt giới hạn thì từ chối cả file, không hiện bảng xem trước: "File vượt quá 5 MB" hoặc "File có N dòng, tối đa 100 dòng mỗi lần nhập". Máy chủ cũng chặn đợt import vượt 100 dòng.
- Trình duyệt đọc file; máy chủ kiểm tra lại từng dòng khi nhận, không tin hoàn toàn kết quả phía trình duyệt.
- Gửi lên máy chủ theo lô 30 dòng mỗi request để nằm trong giới hạn truy vấn của Worker bản free.
- Mỗi lần nhập tạo một bản ghi đợt import (tên file, số dòng, người nhập) để tra lại nguồn của bản ghi.

## 6. F05 Quản lý cán bộ, F06 Quản lý đơn vị, F07 Đăng nhập và F08 Quản lý người dùng

F05, F06 và F08 chỉ dành cho Quản trị. F07 dành cho mọi người dùng.

### F05 Quản lý cán bộ

Danh sách cán bộ dùng khi nhập khen thưởng cá nhân. Lọc theo Đơn vị và Đội (quy tắc giống F01) và ô tìm kiếm theo họ tên, số hiệu hoặc mã cán bộ. Phân trang 10 dòng.

Cột bảng: Mã, Họ tên (liên kết mở F02), Năm sinh, Số hiệu, Cấp bậc, Chức vụ, Đơn vị / đội, Vào ngành (mm/yyyy), Thâm niên ("N năm"), Xếp loại, Số khen thưởng, nút Sửa và Xóa. Ô chưa có dữ liệu hiện "—"; bảng cuộn ngang trên màn hình hẹp.

**Form thêm / sửa** (modal)

| Trường | Bắt buộc | Quy tắc |
| --- | --- | --- |
| Mã cán bộ | Tự sinh | Dạng CB + 3 chữ số, không sửa được |
| Họ tên | Có | Gộp khoảng trắng thừa |
| Năm sinh | Có | 1950–2010 |
| Số hiệu | Có | Đúng 6 chữ số, không trùng cán bộ khác (BR-06) |
| Cấp bậc | Có | Chọn từ danh mục cấp bậc |
| Chức vụ | Có | Chọn từ danh mục chức vụ. Mockup cho nhập tự do có gợi ý; bản thật dùng danh mục |
| Đơn vị | Có |  |
| Đội | Không | Mục đầu "Không thuộc đội"; khóa khi đơn vị không có đội |
| Tháng năm vào ngành | Không | Ô chọn tháng (`YYYY-MM`). Không ở tương lai (theo tháng hiện tại giờ Việt Nam) và năm vào ngành ≥ năm sinh + 16. Lỗi: "Tháng năm vào ngành không được ở tương lai", "Tháng năm vào ngành phải sau năm sinh ít nhất 16 năm" |
| Xếp loại | Không | Chọn một mức từ danh mục xếp loại, mục đầu "Chưa xếp loại". Mỗi cán bộ chỉ có một giá trị hiện tại. Lỗi: "Xếp loại không hợp lệ" |

Thâm niên không lưu trong cơ sở dữ liệu: bằng năm hiện tại (giờ Việt Nam) trừ năm vào ngành, không xét tháng; để trống khi chưa có tháng năm vào ngành. Hàm dùng chung `src/shared/officer-seniority.ts`.

- Lưu thành công: đóng modal, hiện thông báo, làm mới mọi danh sách và bộ lọc có hiển thị cán bộ.
- **Xóa**: hiện hộp xác nhận ghi rõ họ tên, số hiệu và số khen thưởng sẽ bị xóa theo (BR-05). Thao tác không hoàn tác trên giao diện.

### F06 Quản lý đơn vị và đội

Danh sách đơn vị, tìm theo tên hoặc mã. Cột bảng: Mã, Tên đơn vị (liên kết mở modal xem, dòng phụ là mô tả), Loại, Số đội, Số cán bộ, Số khen thưởng, nút Sửa và Xóa.

**Xem**: modal gồm mã, loại, số đội, số cán bộ, số khen thưởng, mô tả và bảng đội trực thuộc (tên đội, số cán bộ, số khen thưởng). Có nút Sửa đơn vị.

**Form thêm / sửa** (modal)

| Trường | Bắt buộc | Quy tắc |
| --- | --- | --- |
| Mã đơn vị | Có | Không trùng, không phân biệt hoa thường |
| Loại đơn vị | Có | Phòng hoặc Thủy đoàn |
| Tên đơn vị | Có | Không trùng |
| Mô tả | Không |  |
| Đội trực thuộc | Không | Danh sách sửa được tại chỗ: thêm dòng, sửa tên, xóa dòng. Tên không trống và không trùng trong đơn vị |

- Xóa một đội đang có cán bộ hoặc khen thưởng: chặn, hiện "Không thể xóa … vì còn x cán bộ và y khen thưởng thuộc đội này" (BR-04).
- Đổi tên đội giữ nguyên mã đội, nên lịch sử khen thưởng của đội vẫn đúng.
- **Xóa đơn vị**: nếu còn cán bộ hoặc khen thưởng thì hiện "Chưa thể xóa đơn vị" kèm số lượng; nếu không thì hiện hộp xác nhận, xóa cả các đội trực thuộc.

### F07 Đăng nhập, đổi mật khẩu, đăng xuất

Hệ thống tự quản lý tài khoản trong bảng users, không dùng Cloudflare Access. Chưa đăng nhập thì mọi đường dẫn đều chuyển về màn hình đăng nhập.

| Màn hình | Trường | Quy tắc |
| --- | --- | --- |
| Đăng nhập | Tên đăng nhập, Mật khẩu | Sai thì báo chung "Tên đăng nhập hoặc mật khẩu không đúng", không nói rõ sai phần nào. Tài khoản bị khóa (đăng nhập sai nhiều lần hoặc bị Quản trị khóa): chỉ khi nhập **đúng** mật khẩu mới báo "Tài khoản đang bị khóa"; nhập sai vẫn báo chung như trên để không dò được tên đăng nhập. Quá 10 lần thử/phút từ một IP thì báo "Bạn thử quá nhiều lần, vui lòng đợi rồi thử lại" |
| Đổi mật khẩu | Mật khẩu hiện tại, Mật khẩu mới, Nhập lại | Mật khẩu mới tối thiểu 10 ký tự, khác mật khẩu cũ, hai ô nhập khớp nhau |

- **Phiên đăng nhập:** token ngẫu nhiên 32 byte trong cookie `HttpOnly; Secure; SameSite=Strict`. Bảng sessions chỉ lưu bản băm SHA-256 của token. Phiên hết hạn sau 8 giờ không hoạt động và tối đa 7 ngày kể từ lúc đăng nhập; `last_seen_at` chỉ cập nhật khi đã quá 15 phút để tiết kiệm lượt ghi D1.
- **Mật khẩu:** băm bằng PBKDF2-SHA256 qua WebCrypto, mỗi người một salt riêng, 100.000 vòng lặp (mức tối đa Workers cho phép).
- **Chống dò mật khẩu:** sai 5 lần liên tiếp thì khóa tài khoản 15 phút. Các lần thử trong thời gian khóa không được tính thêm và không kéo dài thời gian khóa (kẻ lạ không khóa dài hạn được tài khoản). Ngoài ra `/api/auth/login` giới hạn 10 lần/phút theo IP (Workers Rate Limiting binding).
- **Bắt đổi mật khẩu:** tài khoản mới tạo hoặc vừa được đặt lại mật khẩu phải đổi mật khẩu trước khi dùng bất kỳ chức năng nào.
- **Đổi mật khẩu thành công:** hủy mọi phiên khác của người đó, giữ phiên hiện tại.
- **Đăng xuất:** xóa phiên trong database và xóa cookie. Nút đăng xuất và đổi mật khẩu nằm ở góc menu, kèm họ tên và vai trò người đang đăng nhập.
- **Quên mật khẩu:** không tự khôi phục qua email; Quản trị đặt lại mật khẩu tạm ở F08.
- **Quản trị đầu tiên:** tạo bằng script chạy qua wrangler khi cài đặt, có cờ bắt đổi mật khẩu.

### F08 Quản lý người dùng

Danh sách tài khoản, tìm theo tên đăng nhập hoặc họ tên. Cột bảng: Tên đăng nhập, Họ tên, Vai trò, Trạng thái (Hoạt động / Đã khóa), Đăng nhập gần nhất, nút Sửa, Đặt lại mật khẩu, Khóa hoặc Mở khóa.

**Form thêm / sửa** (modal)

| Trường | Bắt buộc | Quy tắc |
| --- | --- | --- |
| Tên đăng nhập | Có | 3–32 ký tự: chữ không dấu, số, dấu chấm, gạch dưới; không trùng; không sửa được sau khi tạo |
| Họ tên | Có |  |
| Vai trò | Có | Quản trị, Biên tập hoặc Xem |
| Mật khẩu tạm | Có, khi thêm | Tối thiểu 10 ký tự; có nút tạo ngẫu nhiên và sao chép. Mật khẩu chỉ hiện một lần |

- **Đặt lại mật khẩu:** sinh mật khẩu tạm, bật cờ bắt đổi mật khẩu, hủy mọi phiên của người đó, mở khóa nếu đang bị khóa do đăng nhập sai.
- **Khóa tài khoản** hoặc **đổi vai trò:** hủy ngay mọi phiên của người đó để quyền mới có hiệu lực.
- Không xóa cứng tài khoản đã tạo dữ liệu (có trong created\_by), chỉ khóa. Tài khoản chưa tạo dữ liệu thì được xóa.
- Quản trị không tự hạ vai trò hay tự khóa chính mình. Hệ thống luôn phải còn ít nhất 1 Quản trị đang hoạt động.
- Mọi thao tác trên tài khoản đều ghi vào audit\_logs.

## 7. Thiết kế cơ sở dữ liệu

Cơ sở dữ liệu SQLite (Cloudflare D1) gồm 15 bảng: 8 bảng danh mục (thêm officer_ratings), 4 bảng nghiệp vụ, bảng người dùng, bảng phiên đăng nhập và bảng đếm award_counters (do trigger cập nhật, phục vụ thống kê). Bảng awards là trung tâm. Câu lệnh tạo bảng, index, trigger và dữ liệu danh mục nằm trong thư mục `migrations/` (0001 schema gốc từ khen-thuong-schema-seed.sql phiên bản 2, các migration sau bổ sung).

&#91;embedded content: sơ đồ quan hệ · 13 bảng\]

Mũi tên chỉ từ cột khóa ngoại tới bảng được tham chiếu. Cột created\_by của officers và awards cũng trỏ tới users, không vẽ để sơ đồ đỡ rối.

### Bảng awards (bản ghi danh hiệu, khen thưởng)

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| id | INTEGER | Khóa chính |  |
| subject | TEXT | TAP\_THE hoặc CA\_NHAN | Đối tượng |
| officer\_id | INTEGER | FK officers; bắt buộc khi CA\_NHAN, NULL khi TAP\_THE | Cán bộ được khen |
| unit\_id | INTEGER | FK units, bắt buộc | Đơn vị tại thời điểm khen (BR-02) |
| team\_id | INTEGER | FK teams; phải thuộc unit\_id | NULL là khen cấp đơn vị |
| award\_type\_id | INTEGER | FK award\_types, bắt buộc; phải hợp subject\_scope | Danh hiệu hoặc hình thức khen thưởng |
| award\_variant\_id | INTEGER | FK award\_variants; bắt buộc khi requires\_variant = 1 | Loại huân chương |
| year | INTEGER | 1990–2100 | Năm khen thưởng |
| decision\_number | TEXT | Bắt buộc, tối đa 50 ký tự | Số quyết định |
| decision\_date | TEXT | Bắt buộc, dạng YYYY-MM-DD | Ngày quyết định |
| authority\_id | INTEGER | FK authorities, bắt buộc | Cấp quyết định |
| achievement | TEXT | Bắt buộc, tối đa 2.000 ký tự | Thành tích, nội dung khen thưởng |
| note | TEXT | Tối đa 500 ký tự | Ghi chú |
| import\_batch\_id | INTEGER | FK import\_batches | NULL khi nhập tay |
| created\_by | INTEGER | FK users | Người tạo |
| created\_at, updated\_at | TEXT | UTC |  |
| deleted\_at | TEXT |  | Khác NULL là đã xóa mềm |

### Bảng officers (cán bộ)

| Cột | Kiểu | Ràng buộc | Mô tả |
| --- | --- | --- | --- |
| id | INTEGER | Khóa chính |  |
| code | TEXT | Duy nhất | Mã CB001, tự sinh |
| full\_name | TEXT | Bắt buộc | Họ tên |
| full\_name\_search | TEXT | Bắt buộc | Họ tên đã chuẩn hóa (NFC, chữ thường) để tìm kiếm |
| birth\_year | INTEGER | 1950–2010 | Năm sinh |
| badge\_number | TEXT | Đúng 6 chữ số; duy nhất trong các cán bộ chưa xóa | Số hiệu |
| rank\_id | INTEGER | FK ranks, bắt buộc | Cấp bậc |
| position\_id | INTEGER | FK positions, bắt buộc | Chức vụ |
| unit\_id | INTEGER | FK units, bắt buộc | Đơn vị hiện tại |
| team\_id | INTEGER | FK teams; phải thuộc unit\_id | Đội hiện tại, NULL là không thuộc đội |
| joined\_month | TEXT | NULL; dạng `YYYY-MM`, tháng 01–12 (CHECK) | Tháng năm vào ngành; thâm niên tính từ cột này, không lưu |
| rating\_id | INTEGER | FK officer\_ratings; NULL là chưa xếp loại | Xếp loại hiện tại |
| created\_by, created\_at, updated\_at, deleted\_at |  |  | Như bảng awards |

### Các bảng còn lại

| Bảng | Loại | Cột chính | Ghi chú |
| --- | --- | --- | --- |
| units | Danh mục | code, name, kind (PHONG, THUY\_DOAN), description, sort\_order | Mã và tên duy nhất; không xóa được khi đang dùng |
| teams | Danh mục | unit\_id, code, name, sort\_order | Tên duy nhất trong đơn vị; không xóa được khi đang dùng |
| ranks | Danh mục | code, name, rank\_group (HA\_SI\_QUAN, CAP\_UY, CAP\_TA, CAP\_TUONG) |  |
| positions | Danh mục | code, name, level (DON\_VI, DOI, CAN\_BO) |  |
| authorities | Danh mục | code, name | Cấp quyết định |
| award\_types | Danh mục | code, name, form (DANH\_HIEU, KHEN\_THUONG), subject\_scope (TAP\_THE, CA\_NHAN, CA\_HAI), default\_authority\_id, requires\_variant, is\_active | Lưu ma trận ở mục 2 |
| award\_variants | Danh mục | award\_type\_id, code, name, is\_active | Loại huân chương |
| officer\_ratings | Danh mục | code, name, sort\_order, is\_active | Xếp loại cán bộ (4 mức chuẩn); chỉ mức đang hoạt động được chọn |
| users | Hệ thống | username (3–32 ký tự, duy nhất), full\_name, role (ADMIN, EDITOR, VIEWER), password\_hash (PBKDF2), must\_change\_password, failed\_login\_count, locked\_until, last\_login\_at, is\_active | Tài khoản đăng nhập (F07, F08) |
| sessions | Hệ thống | token\_hash (khóa chính, SHA-256 của token trong cookie), user\_id, expires\_at, last\_seen\_at, user\_agent | Xóa người dùng thì xóa phiên theo; Cron Trigger dọn phiên hết hạn mỗi ngày |
| import\_batches | Nghiệp vụ | file\_name, total\_rows, imported\_rows, error\_rows, created\_by | Một dòng cho mỗi lần import |
| audit\_logs | Nghiệp vụ | user\_id, action (CREATE, UPDATE, DELETE, IMPORT, LOGIN, LOGIN\_FAILED, LOGOUT, PASSWORD\_CHANGE, PASSWORD\_RESET, LOCK, UNLOCK), entity, entity\_id, detail (JSON) | Nhật ký thao tác và đăng nhập |

### Index

Các index trên awards đều là index một phần (WHERE deleted\_at IS NULL), nên bản ghi đã xóa không làm chậm truy vấn.

| Index | Cột | Phục vụ |
| --- | --- | --- |
| ix\_awards\_list | awards(year DESC, id DESC) | F01 khi không lọc, sắp xếp mặc định |
| ix\_awards\_unit\_team | awards(unit\_id, team\_id, year DESC) | F01 lọc theo đơn vị, đội |
| ix\_awards\_officer | awards(officer\_id, year DESC) | F02 quá trình khen thưởng |
| ix\_awards\_type | awards(award\_type\_id, subject) | Thống kê theo danh hiệu, đối tượng |
| ix\_awards\_decision | awards(decision\_number) | Tìm theo số quyết định |
| ux\_officers\_badge | officers(badge\_number), cán bộ chưa xóa | BR-06 |
| ix\_officers\_unit\_team | officers(unit\_id, team\_id), cán bộ chưa xóa | F05 và danh sách chọn cán bộ ở F03 |

Kiểm tra trùng (BR-08) không cần index mới: cá nhân dùng ix\_awards\_officer (officer\_id, year), tập thể dùng ix\_awards\_unit\_team (unit\_id, team\_id, year), rồi so award\_type\_id và award\_variant\_id trên vài dòng còn lại.

### Ràng buộc bằng trigger

- Đội của cán bộ và của bản ghi khen thưởng phải thuộc đúng đơn vị.
- Danh hiệu phải áp dụng cho đối tượng (subject\_scope), ví dụ chặn khen tập thể bằng danh hiệu Chiến sĩ thi đua cơ sở.
- Huân chương bắt buộc có loại, và loại phải thuộc đúng hình thức đã chọn.
- Chặn xóa đơn vị hoặc đội còn cán bộ hoặc khen thưởng (BR-04).

Tìm kiếm theo tên dùng LIKE trên cột đã chuẩn hóa, nên phải quét bảng. Với dưới khoảng 10.000 bản ghi thì vẫn nằm xa giới hạn đọc của D1. Nếu dữ liệu lớn hơn, chuyển sang bảng tìm kiếm toàn văn FTS5.

## 8. Dữ liệu danh mục (master data)

Dữ liệu khởi tạo gồm 10 đơn vị, 13 đội, 12 danh hiệu và hình thức khen thưởng, 6 loại huân chương, 4 cấp quyết định, 15 cấp bậc, 7 chức vụ và 4 mức xếp loại cán bộ. Toàn bộ nằm trong file khen-thuong-schema-seed.sql, đã chạy thử trên SQLite.

### Đơn vị và đội

| Mã đơn vị | Tên đơn vị | Loại | Đội trực thuộc (mã: tên) |
| --- | --- | --- | --- |
| P1–P5 | Phòng 1 đến Phòng 5 | Phòng | Không có |
| P6 | Phòng 6 | Phòng | P6-CT1 … P6-CT7: Đội CSGT đường bộ cao tốc số 1 … số 7; P6-TMTH: Đội Tham mưu tổng hợp; P6-HDKT: Đội Hướng dẫn kiểm tra hoạt động TTKS giao thông đường bộ, đường sắt; P6-DS1, P6-DS2: Đội CSGT đường sắt số 1, số 2 |
| P7 | Phòng 7 | Phòng | P7-DD1, P7-DD2: Đội Dẫn đoàn số 1, số 2 |
| P8 | Phòng 8 | Phòng | Không có |
| TD1 | Thủy đoàn I | Thủy đoàn | Không có |
| TD2 | Thủy đoàn II | Thủy đoàn | Không có |

### Danh hiệu thi đua và hình thức khen thưởng (award\_types)

| Mã | Tên | Hình thức | Đối tượng | Cấp quyết định mặc định | Cần chọn loại |
| --- | --- | --- | --- | --- | --- |
| CO\_TD\_CP | Cờ Thi đua của Chính phủ | Danh hiệu | Tập thể | Thủ tướng Chính phủ |  |
| CO\_TD\_BCA | Cờ thi đua của Bộ Công an | Danh hiệu | Tập thể | Bộ trưởng Bộ Công an |  |
| DV\_QUYET\_THANG | Đơn vị quyết thắng | Danh hiệu | Tập thể | Thủ trưởng đơn vị |  |
| DV\_TIEN\_TIEN | Đơn vị tiên tiến | Danh hiệu | Tập thể | Thủ trưởng đơn vị |  |
| CSTD\_TOAN\_QUOC | Chiến sĩ thi đua toàn quốc | Danh hiệu | Cá nhân | Thủ tướng Chính phủ |  |
| CSTD\_TOAN\_LL | Chiến sĩ thi đua toàn lực lượng | Danh hiệu | Cá nhân | Bộ trưởng Bộ Công an |  |
| CSTD\_CO\_SO | Chiến sĩ thi đua cơ sở | Danh hiệu | Cá nhân | Thủ trưởng đơn vị |  |
| CS\_TIEN\_TIEN | Chiến sĩ tiên tiến | Danh hiệu | Cá nhân | Thủ trưởng đơn vị |  |
| HUAN\_CHUONG | Huân chương | Khen thưởng | Cả hai | Chủ tịch nước | Có |
| BK\_TTG | Bằng khen Thủ tướng Chính phủ | Khen thưởng | Cả hai | Thủ tướng Chính phủ |  |
| BK\_BCA | Bằng khen Bộ Công an | Khen thưởng | Cả hai | Bộ trưởng Bộ Công an |  |
| GIAY\_KHEN | Giấy khen | Khen thưởng | Cả hai | Thủ trưởng đơn vị |  |

### Các danh mục khác

| Danh mục | Giá trị (mã) |
| --- | --- |
| Loại huân chương (award\_variants) | Huân chương Bảo vệ Tổ quốc hạng Nhất, Nhì, Ba (HC\_BVTQ\_1–3); Huân chương Chiến công hạng Nhất, Nhì, Ba (HC\_CC\_1–3) |
| Cấp quyết định (authorities) | Chủ tịch nước (CTN); Thủ tướng Chính phủ (TTG); Bộ trưởng Bộ Công an (BCA); Thủ trưởng đơn vị (DV) |
| Cấp bậc (ranks) | Hạ sĩ quan: Hạ sĩ, Trung sĩ, Thượng sĩ. Cấp úy: Thiếu úy, Trung úy, Thượng úy, Đại úy. Cấp tá: Thiếu tá, Trung tá, Thượng tá, Đại tá. Cấp tướng: Thiếu tướng, Trung tướng, Thượng tướng, Đại tướng |
| Chức vụ (positions) | Cấp đơn vị: Trưởng phòng, Phó Trưởng phòng, Thủy đoàn trưởng, Phó Thủy đoàn trưởng. Cấp đội: Đội trưởng, Phó Đội trưởng. Cán bộ |
| Xếp loại cán bộ (officer\_ratings) | Hoàn thành xuất sắc nhiệm vụ (HTXSNV); Hoàn thành tốt nhiệm vụ (HTTNV); Hoàn thành nhiệm vụ (HTNV); Không hoàn thành nhiệm vụ (KHTNV) |
| Người dùng (users) | Không có dữ liệu mẫu; tài khoản Quản trị đầu tiên tạo bằng script khi cài đặt (F07) |

Danh sách loại huân chương và chức vụ là bản khởi đầu, nghiệp vụ cần rà soát và bổ sung. Danh mục là bảng dữ liệu, nên thêm giá trị mới không cần sửa code.

## 9. API, yêu cầu phi chức năng và vấn đề mở

### API

API dạng REST, trả JSON, chạy bằng Hono trong cùng một Cloudflare Worker với giao diện React. Danh sách luôn phân trang ở phía SQL (tham số `page`, `size` tối đa 50).

| Phương thức | Đường dẫn | Mô tả | Vai trò |
| --- | --- | --- | --- |
| POST | /api/auth/login | Đăng nhập, tạo phiên và trả cookie | Chưa đăng nhập |
| POST | /api/auth/logout | Xóa phiên hiện tại | Tất cả |
| POST | /api/auth/change-password | Đổi mật khẩu, hủy các phiên khác | Tất cả |
| GET | /api/me | Người đang đăng nhập: họ tên, vai trò, cờ bắt đổi mật khẩu | Tất cả |
| GET | /api/master | Toàn bộ danh mục: đơn vị, đội, danh hiệu, loại huân chương, cấp quyết định, cấp bậc, chức vụ, xếp loại cán bộ. Trình duyệt lưu cache | Tất cả |
| GET | /api/awards | Danh sách F01. Lọc: `unit_id`, `team_id`, `subject`, `form`, `q`. Trả `items`, `total`, `stats` | Tất cả |
| GET | /api/officers/:id | Chi tiết cán bộ kèm quá trình khen thưởng (F02) | Tất cả |
| POST | /api/awards | Thêm một bản ghi (F03). Có trùng theo BR-08 thì trả 409 kèm danh sách bản ghi trùng; gửi lại với `confirm_duplicate: true` để vẫn lưu | ADMIN, EDITOR |
| GET | /api/awards/:id | Chi tiết một bản ghi để mở form sửa (F09) | ADMIN, EDITOR |
| PUT | /api/awards/:id | Sửa bản ghi (F09); xử lý trùng giống POST, bỏ qua chính bản ghi đang sửa | ADMIN, EDITOR |
| DELETE | /api/awards/:id | Xóa mềm bản ghi (F09) | ADMIN, EDITOR |
| POST | /api/awards/import | Nhận một lô tối đa 30 dòng, kiểm tra lại và lưu (F04). Trả kết quả từng dòng gồm lỗi và cảnh báo trùng; dòng trùng chỉ được lưu khi gửi `include_duplicates: true` | ADMIN, EDITOR |
| GET | /api/officers/options | Danh sách cán bộ rút gọn (mã, họ tên, cấp bậc, số hiệu, đơn vị, đội) để chọn ở F03, F09 và đối chiếu mã ở F04 | ADMIN, EDITOR |
| GET | /api/officers | Danh sách F05. Lọc: `unit_id`, `team_id`, `q` | ADMIN |
| POST, PUT | /api/officers, /api/officers/:id | Thêm, sửa cán bộ | ADMIN |
| DELETE | /api/officers/:id | Xóa mềm cán bộ và các khen thưởng của cán bộ | ADMIN |
| GET | /api/units, /api/units/:id | Danh sách, chi tiết đơn vị kèm đội và số lượng (F06) | ADMIN |
| POST, PUT | /api/units, /api/units/:id | Thêm, sửa đơn vị; PUT gửi kèm toàn bộ danh sách đội | ADMIN |
| DELETE | /api/units/:id | Xóa đơn vị, bị chặn theo BR-04 | ADMIN |
| GET, POST, PUT | /api/users, /api/users/:id | Danh sách, thêm, sửa người dùng; khóa và mở khóa qua PUT (F08) | ADMIN |
| POST | /api/users/:id/reset-password | Đặt lại mật khẩu tạm | ADMIN |
| DELETE | /api/users/:id | Xóa tài khoản chưa tạo dữ liệu | ADMIN |

Mọi request (trừ đăng nhập) đi qua middleware đọc cookie phiên, lấy người dùng và vai trò. Không có phiên hợp lệ trả 401; sai vai trò trả 403. Người dùng còn cờ bắt đổi mật khẩu chỉ gọi được /api/me, /api/auth/change-password và /api/auth/logout. Mọi request ghi được kiểm tra header Origin để chống CSRF.

Mọi thao tác ghi đều ghi một dòng vào audit\_logs.

### Yêu cầu phi chức năng

| Hạng mục | Yêu cầu |
| --- | --- |
| Hạ tầng | Một Cloudflare Worker gói free: Hono (API) + React build (file tĩnh) + D1 (dữ liệu) + Cron Trigger (dọn phiên) |
| Stack | TypeScript, Hono, Drizzle ORM, Zod dùng chung FE/BE; React, Vite, React Router, TanStack Query, react-hook-form |
| Đăng nhập | Tài khoản trong bảng users (F07, F08); không dùng Cloudflare Access |
| Bảo mật | Mật khẩu PBKDF2-SHA256; cookie phiên HttpOnly, Secure, SameSite=Strict; khóa 15 phút sau 5 lần sai; rule giới hạn tần suất cho /api/auth/login; chỉ dùng HTTPS |
| Giới hạn CPU | Worker free giới hạn thời gian CPU mỗi request rất thấp; endpoint đăng nhập (băm PBKDF2) phải đo ngay khi dựng nền tảng. Vượt thì nâng lên Workers Paid, không giảm số vòng lặp |
| Quy mô | 3–5 người dùng, ước tính dưới 50.000 bản ghi khen thưởng |
| Giới hạn D1 free | Mỗi ngày 5 triệu dòng đọc, 100 nghìn dòng ghi. Mọi truy vấn danh sách phải dùng index (mục 7) và LIMIT |
| Sao lưu | Export database hàng tuần bằng GitHub Actions, ngoài Time Travel 7 ngày của D1 |
| Giao diện | Chạy trên trình duyệt máy tính và điện thoại, hỗ trợ chế độ sáng/tối như mockup |

### Vấn đề mở

- [x] Có cần sửa, xóa bản ghi khen thưởng không: có, thành chức năng F09.
- [x] Có cảnh báo trùng khi cùng đối tượng, cùng danh hiệu, cùng năm không: có, theo BR-08, chỉ cảnh báo và không chặn.
- [x] Đơn vị quyết thắng, Đơn vị tiên tiến có xét cho cấp đội không: có (BR-01).
- [x] Biên tập có được xem F01 và modal F02 không: có.
- [ ] Xác nhận bảng cấp quyết định mặc định ở mục 2.
- [ ] Bổ sung đầy đủ danh sách loại huân chương.
- [ ] Cờ Thi đua của Chính phủ và Cờ thi đua của Bộ Công an có xét cho cấp đội không; hệ thống hiện chưa chặn.
- [ ] Biên tập được sửa, xóa mọi bản ghi hay chỉ bản ghi do mình tạo; spec đang cho sửa, xóa mọi bản ghi.
- [ ] Đơn vị có được phép lưu dữ liệu cán bộ trên hạ tầng Cloudflare không; nếu không, chuyển sang máy chủ nội bộ với cùng schema.
