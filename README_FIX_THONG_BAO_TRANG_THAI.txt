FIX THÔNG BÁO KHI CẬP NHẬT TRẠNG THÁI HÀNG LỖI

Đã sửa:
1. Khi đổi trạng thái sang Fixing / Đang sửa sẽ tạo notification và gửi Web Push.
2. Khi đổi trạng thái sang Resolved / Xong sẽ tạo notification và gửi Web Push.
3. Bỏ chặn trong sendWebPushForNotification: trước đây chỉ gửi type defect_created.
4. Toast trong app cũng hiện cho thông báo cập nhật trạng thái.
5. service-worker.js dùng badge icons/notification-badge.png và tăng CACHE_NAME.
6. Thêm icons/notification-badge.png nền trong suốt.

Lưu ý sau khi upload:
- Upload toàn bộ source lên GitHub Pages.
- Nếu bạn dùng Supabase Edge Function trong thư mục supabase/functions/send-push thì deploy lại function send-push.
- Trên điện thoại, đóng hẳn PWA rồi mở lại. Nếu service worker cũ còn cache thì gỡ PWA và cài lại.
