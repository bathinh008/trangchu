BẢN DASHBOARD QUẢN LÝ HÀNG LỖI V3.9
====================================

Luồng xử lý hiện tại:
- Chỉ có 2 trạng thái: Chờ xử lý và Hoàn thành.
- Báo cáo mới luôn được tạo ở trạng thái Chờ xử lý.
- Không còn Người phụ trách, Hạn xử lý và trạng thái Đang sửa.
- Vẫn lưu thời gian hoàn thành và ghi chú kết quả xử lý.

Dashboard:
- 3 KPI: Tổng số lượng lỗi, Chờ xử lý, Hoàn thành.
- Thống kê theo 7 ngày, 30 ngày, 90 ngày, khoảng ngày tùy chọn hoặc toàn bộ.
- Biểu đồ xu hướng phát sinh và tỷ lệ 2 trạng thái.
- Top 5 nhà cung cấp có nhiều báo cáo lỗi.
- Danh sách hàng lỗi cần chú ý, ưu tiên theo mức độ và thời gian tồn.
- Bộ lọc thời gian tồn: từ 3 ngày, 7 ngày hoặc 30 ngày.

Các chức năng được giữ nguyên:
- Báo hàng lỗi và tải nhiều hình ảnh.
- Tìm kiếm, lọc, nhập và xuất Excel.
- Lịch sử hoàn thành.
- Tài khoản, thông báo và nhật ký hoạt động.
- Giao diện responsive cho máy tính và điện thoại.

CẬP NHẬT SUPABASE
=================
Chạy file SUPABASE_UPGRADE_V3_9.sql một lần trong Supabase > SQL Editor.
File SQL sẽ:
- Bổ sung updated_at, resolved_at và resolution_note nếu chưa có.
- Chuyển dữ liệu trạng thái Fixing cũ về Pending.
- Không xóa dữ liệu hoặc các cột cũ trong database.

CÁCH CHẠY
=========
- Trên máy tính: bấm START_LOCAL.bat rồi mở http://localhost:8080.
- Hoặc tải toàn bộ thư mục lên GitHub Pages.
- Không xóa thư mục vendor hoặc file tailwind.min.css.
- Khi cập nhật GitHub Pages, ghi đè toàn bộ file và xóa cache trang nếu vẫn thấy bản cũ.

File chính:
- index.html
- style.css
- app.js
- mobile.js
- supabase.js
- tailwind.min.css
- vendor/
- SUPABASE_UPGRADE_V3_9.sql


CẬP NHẬT V3.10
- Nút trạng thái hiển thị hàng ngang.
- Trạng thái hiện tại được làm xám và không thể bấm lại.


CẬP NHẬT V3.11
- Nút Hoàn thành yêu cầu xác nhận trước khi lưu trạng thái.
