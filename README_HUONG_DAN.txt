# Bản trang chủ đã gắn web con Quản lý hàng lỗi

Cấu trúc sau khi cập nhật:

- `index.html`: Trang chủ nhân viên.
- `admin.html`: Trang cấu hình link/bật tắt module.
- `hang-loi/index.html`: Web con quản lý hàng lỗi.
- `manifest.json`: Cấu hình PWA để cài như app.
- `service-worker.js`: Service Worker đặt ở thư mục gốc, quản lý được cả trang chủ và web con.
- `icons/`: Icon PWA.

## Cách dùng

1. Upload toàn bộ thư mục này lên hosting/GitHub Pages/Netlify/Vercel.
2. Mở `admin.html`.
3. Ở mục **Link Theo dõi hàng lỗi**, nhập: `hang-loi/`.
4. Bật công tắc **Theo dõi hàng lỗi**.
5. Bấm **Lưu cài đặt**.
6. Mở lại `index.html`, nút **Theo dõi hàng lỗi** sẽ mở web con `hang-loi/`.

## PWA

Trang chủ đã có `manifest.json` và `service-worker.js`, nên trên điện thoại có thể dùng chức năng **Thêm vào màn hình chính / Cài đặt ứng dụng**.

Lưu ý: bản này mới chuẩn bị nền PWA và Service Worker. Muốn tắt app vẫn nhận thông báo hệ thống thì cần làm thêm Web Push server/Edge Function để gửi push.

CAP NHAT POPUP THONG BAO HANG LOI MOI
- Web con /hang-loi/ da co popup noi khi phat hien notification moi co type = defect_created.
- Popup chi hien khi nguoi dung dang mo web/PWA.
- Lan dau dang nhap se khong bung lai thong bao cu; cac thong bao moi sau do se hien popup, rung va am bao nhe neu trinh duyet cho phep.
