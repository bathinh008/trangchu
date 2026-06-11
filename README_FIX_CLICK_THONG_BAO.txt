FIX ĐƯỜNG DẪN KHI BẤM THÔNG BÁO PWA

Lỗi thường gặp:
- Web chạy trong thư mục con, ví dụ: https://bathinh008.github.io/trangchu-main/
- Nhưng service-worker hoặc payload push lại mở /hang-loi/
- Trình duyệt hiểu /hang-loi/ là https://bathinh008.github.io/hang-loi/
- Kết quả: bấm thông báo trên điện thoại thì quay lại sai đường dẫn.

Đã cập nhật:
1. service-worker.js
   - Thêm APP_SCOPE_URL lấy đúng thư mục gốc của PWA.
   - Thêm resolveAppUrl().
   - Khi bấm thông báo, /hang-loi/ hoặc hang-loi/ đều được đổi về đúng scope của app.
   - Icon/badge thông báo cũng dùng đường dẫn theo scope.

2. hang-loi/app.js
   - Đổi data.url khi test thông báo thành hang-loi/.
   - Đổi payload gửi Edge Function thành hang-loi/.

3. supabase/functions/send-push/index.ts
   - Đổi url mặc định từ /hang-loi/ thành hang-loi/.

Sau khi upload:
- Vào DevTools > Application > Service Workers > Unregister service worker cũ nếu test trên PC.
- Trên điện thoại, đóng app PWA hoàn toàn rồi mở lại.
- Nếu vẫn chưa ăn, gỡ icon PWA khỏi màn hình chính rồi cài lại.
- Service Worker có CACHE_NAME mới nên thường sẽ tự cập nhật.
