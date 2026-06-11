HƯỚNG DẪN SỬ DỤNG BẢN NÂNG CẤP MOBILE

1) Upload toàn bộ 5 file này lên cùng một thư mục:
   - index.html
   - style.css
   - supabase.js
   - app.js
   - mobile.js

2) Mở index.html như bản cũ. Không đổi tên file nếu chưa sửa lại đường dẫn trong index.html.

3) Các nâng cấp chính:
   - Dọn CSS mobile về block cuối style.css để giảm lỗi override.
   - Header mobile tự ẩn khi kéo xuống, hiện khi kéo lên.
   - Bấm logo hoặc tiêu đề để về tab Báo lỗi.
   - Chuông thông báo rung nhẹ khi có thông báo mới.
   - Bottom tab tự co theo quyền tài khoản.
   - Empty state đẹp cho các tab khi chưa có dữ liệu.
   - Pull-to-refresh nội bộ trên mobile.
   - Nút xóa nhanh ô tìm kiếm trên cả mobile và PC.
   - Ảnh báo lỗi được nén, preview dạng lưới, có thể xóa trước khi gửi.
   - Offline nhẹ: nếu mất mạng khi lưu báo lỗi, dữ liệu được lưu tạm ở localStorage và tự đồng bộ khi có mạng.

4) Lưu ý ảnh nhiều ảnh:
   - UI hỗ trợ chọn tối đa 5 ảnh.
   - Nếu bảng defects có cột image_urls, hệ thống sẽ lưu danh sách ảnh.
   - Nếu chưa có cột image_urls, hệ thống tự tương thích bản cũ và lưu ảnh đầu tiên vào image_url.

SQL tùy chọn nếu muốn lưu nhiều ảnh thật sự:
ALTER TABLE defects ADD COLUMN IF NOT EXISTS image_urls jsonb DEFAULT '[]'::jsonb;


Cập nhật thêm:
- Xóa preview ảnh cũ dạng ảnh lớn trong modal Báo cáo lỗi.
- Chỉ dùng lưới preview ảnh mới, có nút X xóa từng ảnh.
