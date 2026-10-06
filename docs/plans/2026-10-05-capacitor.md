# Kế hoạch: Đóng gói PTalk thành app iOS & Android bằng Capacitor

**Mục tiêu:** Từ codebase React + Vite hiện tại, build ra app iOS và Android nộp được lên App Store và Google Play, vẫn giữ bản web trên Vercel. Một codebase cho cả ba.

**Nguyên tắc:** Không viết lại giao diện. Chỉ thay những chỗ gọi API trình duyệt không chạy được (hoặc chạy kém) trong WebView bằng plugin Capacitor, qua một lớp `platform` để web vẫn dùng đường cũ.

---

## 0. Hiện trạng đã khảo sát

| Chỗ dùng API trình duyệt | File | Trong app native |
|---|---|---|
| Phát mp3 Kokoro (`new Audio`) | `src/lib/speech.ts` | Chạy được, mp3 đóng gói sẵn trong app |
| Giọng đọc dự phòng `speechSynthesis` | `src/lib/speech.ts`, `src/games/voice/timing.ts` | iOS chạy được; Android WebView không ổn định → plugin TTS |
| Nhận giọng nói `SpeechRecognition` | `src/lib/recognition.ts` | **Không có** trong WKWebView iOS và Android WebView → bắt buộc plugin |
| Ghi âm `getUserMedia` + `MediaRecorder` | `src/lib/recorder.ts` | Chạy được nếu khai báo quyền micro; cần test kỹ trên iOS |
| Lưu tiến độ `localStorage` | `src/lib/progress.ts`, `sfx.ts`, `story/data.ts`, `Wordle.tsx` | Chạy, nhưng iOS có thể xoá khi máy thiếu bộ nhớ → chuyển sang `@capacitor/preferences` |
| Rung `navigator.vibrate` | `src/lib/haptics.ts` | iOS không hỗ trợ → `@capacitor/haptics` |
| Âm hiệu ứng `AudioContext` | `src/lib/sfx.ts`, `Waveform.tsx` | Chạy được |
| Service worker PWA | `vite.config.ts` (vite-plugin-pwa) | Thừa trong app → tắt khi build native |
| Router `HashRouter` | `src/App.tsx` | Chạy tốt trong WebView, giữ nguyên |

Máy hiện có: Node 22, Xcode 26.6, CocoaPods. **Chưa có Android Studio / Android SDK.**

---

## 1. Việc bạn cần chuẩn bị (tôi không làm thay được)

- [ ] Tài khoản **Apple Developer** (99 USD/năm) — đứng tên bạn hay trung tâm, quyết định trước vì đổi sau rất phiền.
- [ ] Tài khoản **Google Play Console** (25 USD một lần).
- [ ] Cài **Android Studio** (kèm Android SDK, JDK 17).
- [ ] Chốt **App ID** (đề xuất `vn.ptalk.review`), **tên app** hiển thị (đề xuất "PTalk Review"), icon 1024×1024.
- [ ] 1 iPhone + 1 Android tầm thấp để test thật.
- [ ] Chính sách quyền riêng tư (URL) — store bắt buộc vì app dùng micro.

---

## 2. Các giai đoạn

### Giai đoạn 1 — Khung Capacitor chạy được (≈ 0,5 ngày) ✅ XONG 2026-10-05
- Cài `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`.
- `capacitor.config.ts`: `appId`, `appName`, `webDir: 'dist'`.
- Thêm biến build `VITE_TARGET=native`: khi native thì **tắt vite-plugin-pwa** và ẩn route `/landing`, `/bang-gia` (đó là trang bán hàng, không thuộc app).
- Script mới: `build:native` → `vite build` + `cap sync`.
- `npx cap add ios` / `npx cap add android`, chạy lên simulator.
- **Xong khi:** mở được app trên iOS Simulator và Android Emulator, vào được bài học, chơi được 1 trò.
- **Kết quả:** Capacitor 8.5.2; app chạy trên iOS Simulator (iPhone 17 Pro), hiện màn chào mừng. Dự án Android đã tạo, chưa chạy vì máy chưa có Android SDK. Chưa bấm thử vào bài học trên simulator (cần thao tác tay).

### Giai đoạn 2 — Lớp `platform` và thay API (≈ 1,5–2 ngày) ✅ XONG 2026-10-05 — chi tiết: [capacitor-phase2](2026-10-05-capacitor-phase2.md)
Tạo `src/lib/platform.ts` với `isNative()`; mỗi file dưới đây chọn đường web hoặc native qua lớp này, test web hiện tại vẫn phải xanh.

1. **Lưu trữ:** `src/lib/storage.ts` bọc `get/set/remove`. Native dùng `@capacitor/preferences`, có bước **di chuyển một lần** từ `localStorage` sang Preferences để không mất tiến độ. Đổi 4 file đang dùng `localStorage`.
2. **Nhận giọng nói:** `@capacitor-community/speech-recognition`, giữ nguyên interface của `recognition.ts` (start, kết quả, các lỗi `unsupported/denied/network`) để Karaoke, SpeakIt, Boss, role-play không phải sửa.
3. **Giọng đọc dự phòng:** `@capacitor-community/text-to-speech` cho câu không có mp3; giữ sự kiện tiến độ để karaoke vẫn tô chữ (dùng nhánh ước lượng thời gian khi plugin không báo vị trí từ).
4. **Rung:** `@capacitor/haptics` trong `haptics.ts`.
5. **Ghi âm:** giữ `MediaRecorder`, khai báo quyền; nếu iOS ghi lỗi thì chuyển sang plugin ghi âm native (dự phòng, chỉ làm khi test thấy lỗi).
- **Xong khi:** `npm test` xanh, web không đổi hành vi, trên simulator chạy được Karaoke và role-play có micro.

### Giai đoạn 3 — Native shell (≈ 1 ngày) ✅ XONG 2026-10-06 — chi tiết: [capacitor-phase3](2026-10-05-capacitor-phase3.md)
- Icon và splash bằng `@capacitor/assets` từ icon 1024 và màu `#13203f`.
- `@capacitor/status-bar` (màu nền tối), `@capacitor/splash-screen` (thay splash web hiện tại trong `src/lib/splash.ts` khi native).
- Safe area: thêm `env(safe-area-inset-*)` cho header và thanh dưới (tai thỏ iPhone, thanh điều hướng Android).
- Khoá dọc màn hình, tắt zoom, tắt kéo nảy trang (overscroll).
- Nút Back cứng của Android: `@capacitor/app` → quay lại màn trước, ở màn chủ thì thoát.
- Quyền: iOS `Info.plist` (`NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription` bằng tiếng Việt); Android `RECORD_AUDIO`.
- Tắt phát audio khi app vào nền (`App.addListener('pause')`).
- **Xong khi:** app trông và cư xử như app native trên cả hai simulator.

### Giai đoạn 4 — Test trên máy thật (≈ 1 ngày)
Danh sách kiểm:
- [ ] Mở app lần đầu: nhập tên, vào bài 1 và bài 2.
- [ ] Phát audio Kokoro, chế độ chậm, chuyển câu liên tục không chồng tiếng.
- [ ] Micro: xin quyền lần đầu, từ chối rồi bật lại trong Cài đặt.
- [ ] Karaoke, SpeakIt, Boss, role-play mission, Chat, Phim tương tác.
- [ ] Game vẽ liên tục: Ninja, Race, Wheel — đo mượt trên Android tầm thấp.
- [ ] Tắt mạng hoàn toàn: mọi thứ vẫn chạy.
- [ ] Đóng app, mở lại, khởi động lại máy: XP, Leitner, tên còn nguyên.
- [ ] Nâng cấp bản app (cài đè): tiến độ còn nguyên.
- **Xong khi:** hết lỗi chặn; lỗi nhỏ ghi lại.

### Giai đoạn 5 — Phát hành (≈ 1 ngày làm + thời gian duyệt)
- Ký app: iOS qua Xcode (tài khoản của bạn), Android tạo keystore — **lưu keystore cẩn thận, mất là không cập nhật app được nữa**.
- Ảnh chụp store (6.7" iPhone, Android phone), mô tả tiếng Việt, mục quyền riêng tư (không thu thập dữ liệu; micro chỉ dùng trên máy).
- TestFlight nội bộ và Google Play Internal testing trước, cho vài giáo viên dùng thử.
- Nộp duyệt. Apple thường 1–3 ngày, Google vài giờ đến vài ngày.
- **Rủi ro duyệt Apple:** app "chỉ là website bọc" có thể bị từ chối (Guideline 4.2). PTalk có audio offline, micro, chấm phát âm, haptics native nên đủ chức năng, nhưng nên ghi rõ trong ghi chú gửi reviewer.

---

## 3. Quy trình sau khi xong

```bash
npm run dev            # sửa giao diện như bây giờ, xem trên trình duyệt
npm run build:native   # build + chép sang ios/ và android/
npx cap open ios       # mở Xcode để chạy máy thật / đóng gói
npx cap open android   # mở Android Studio
```

Thêm bài học mới hoặc audio mới: build lại và phát hành bản app mới (hoặc dùng cập nhật nóng qua Capgo/Appflow ở giai đoạn sau).

---

## 4. Tổng thời gian và rủi ro

| Giai đoạn | Ước lượng |
|---|---|
| 1. Khung Capacitor | 0,5 ngày |
| 2. Lớp platform + plugin | 1,5–2 ngày |
| 3. Native shell | 1 ngày |
| 4. Test máy thật | 1 ngày |
| 5. Phát hành | 1 ngày + chờ duyệt |
| **Tổng** | **5–6 ngày làm việc** |

| Rủi ro | Cách xử lý |
|---|---|
| Nhận giọng nói native trả kết quả khác Web Speech (chấm điểm lệch) | Giữ nguyên hàm chấm trong `scoring.ts`, chỉ thay nguồn chữ; test lại ngưỡng |
| Game canvas giật trên Android rẻ | Đo ở giai đoạn 4; tối ưu riêng trò đó, không đổi công nghệ |
| Apple từ chối 4.2 | Ghi chú reviewer, nhấn mạnh tính năng native |
| Mất tiến độ khi chuyển localStorage → Preferences | Bước di chuyển một lần + test cài đè |
| Dung lượng app (13MB mp3 + code) | Chấp nhận được (~25–30MB); không cần tải thêm |

---

## 5. Thứ tự tôi sẽ làm khi bạn đồng ý

Giai đoạn 1 → 2 → 3 làm liền trên máy này (iOS Simulator chạy được ngay; Android cần bạn cài Android Studio trước). Giai đoạn 4–5 cần bạn có máy thật và tài khoản developer. Tôi không commit hay push; bạn tự commit sau mỗi giai đoạn.
