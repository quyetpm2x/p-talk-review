# Giai đoạn 3 — Vỏ native (icon, splash, thanh trạng thái, nút Back, offline) ✅ XONG 2026-10-06

> **Kết quả:** 208/208 test. iOS Simulator: icon mới, thanh trạng thái chữ trắng, app khoá dọc, font đóng gói (24 file woff2, không còn gọi Google Fonts). **Chưa kiểm bằng mắt:** chuyển tiếp splash native → splash web (app mở quá nhanh để chụp), nút Back Android (chưa có Android SDK), mở app khi mất mạng.

> Thuộc kế hoạch tổng [2026-10-05-capacitor.md](2026-10-05-capacitor.md). Giai đoạn 1, 2 đã xong.

**Mục tiêu:** App trông và cư xử như app native thật trên iOS/Android; chạy offline hoàn toàn từ lần mở đầu.

**Hiện trạng đã khảo sát:**
- Safe area (tai thỏ, thanh home) **đã có** trong `base.css` (`env(safe-area-inset-*)`), `viewport-fit=cover` đã bật → không phải làm.
- `overscroll-behavior-y: none` đã có trên body.
- Font Be Vietnam Pro + Cinzel tải từ Google Fonts → **mất font khi offline** (phát hiện mới).
- iOS đang cho xoay ngang; Android chưa khoá hướng.
- Splash web (animation trong `index.html`) có sẵn; app native chưa có splash/icon riêng (đang là icon mặc định Capacitor).

## Bước 1 — Font đóng gói trong app (≈ 0,5 giờ)
- Cài `@fontsource/be-vietnam-pro`, `@fontsource/cinzel`; import đúng các độ đậm đang dùng trong `src/main.tsx`.
- Bỏ link Google Fonts trong `index.html` (web cũng lợi: PWA cache font, không phụ thuộc Google).
- `pricing.css` (chỉ web) giữ `@import` riêng cho độ đậm 600.

## Bước 2 — Icon & splash native (≈ 1 giờ)
- Tạo `resources/icon.png` 1024×1024 từ `public/icon.svg`, nền navy `#13203f`; `resources/splash.png` 2732×2732 navy + icon giữa.
- `npx @capacitor/assets generate` → icon mọi cỡ iOS, icon thích ứng Android, splash.
- Plugin `@capacitor/splash-screen`: không tự ẩn; ẩn ngay khi React render xong → splash animation web nối tiếp liền mạch (cùng nền navy).

## Bước 3 — Thanh trạng thái (≈ 0,5 giờ)
- `@capacitor/status-bar`: chữ trắng (header app màu navy), Android cho WebView tràn dưới thanh trạng thái để giống iOS (safe area CSS đã xử lý).

## Bước 4 — Nút Back Android + vòng đời app (≈ 1 giờ)
- `@capacitor/app`:
  - Nút Back: còn trang trước → quay lại; ở trang chủ → thoát app.
  - App vào nền: dừng giọng đọc, dừng nghe micro.
- Gom vào `src/lib/native.ts` → `initNative()` gọi một lần ở `main.tsx`; web không làm gì.

## Bước 5 — Khoá màn hình dọc (≈ 0,25 giờ)
- iOS `Info.plist`: iPhone chỉ Portrait (iPad giữ nguyên).
- Android `AndroidManifest.xml`: `android:screenOrientation="portrait"`.

## Bước 6 — Phiên bản app (≈ 0,25 giờ)
- iOS + Android: version `1.0.0`, build `1`.

## Bước 7 — Kiểm tra (≈ 1 giờ)
- [ ] `tsc`, `npm test` xanh; build web không đổi hành vi (vẫn có SW, bảng giá).
- [ ] iOS Simulator: icon mới trên màn hình chính; splash native → splash web liền mạch; chữ thanh trạng thái trắng; xoay máy không xoay app.
- [ ] Bật chế độ máy bay trên Mac (simulator mất mạng) → mở app: font vẫn đúng.
- [ ] Android: biên dịch khi có Android SDK.

## Không làm
- Plugin ghi âm native: chỉ thêm khi bạn thử Mission trên simulator thấy lỗi.
- Bàn phím (resize): hành vi mặc định đủ cho ô nhập tên.
