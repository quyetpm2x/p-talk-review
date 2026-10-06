# Giai đoạn 2 — Thay API trình duyệt bằng plugin native ✅ XONG 2026-10-05

> **Kết quả:** 206/206 test đạt (22 test mới). Bản native có 4 plugin trong dự án iOS (SPM) và Android (Gradle). Đã chạy trên iOS Simulator: khôi phục tiến độ từ bộ lưu native thành công. **Chưa thử bằng tay:** nhận giọng nói, ghi âm, giọng đọc dự phòng trên simulator; Android chưa biên dịch (máy chưa có Android SDK).

> Thuộc kế hoạch tổng [2026-10-05-capacitor.md](2026-10-05-capacitor.md). Giai đoạn 1 đã xong (app chạy trên iOS Simulator).

**Mục tiêu:** Trong app iOS/Android, mọi tính năng chạy như trên web: lưu tiến độ bền, nhận giọng nói, giọng đọc dự phòng, rung, ghi âm. Bản web giữ nguyên hành vi, 184 test vẫn xanh.

**Nguyên tắc:**
- Không đổi giao diện hàm mà các trò chơi đang gọi (`listen`, `hasRecognition`, `speak`, `speakWithProgress`, `buzz`, `useRecorder`, `loadProgress/saveProgress`). Chỉ đổi phần bên trong.
- Mọi nhánh native đi qua `src/lib/platform.ts`; trên web nhánh native không bao giờ chạy.
- Mỗi bước xong là một điểm dừng an toàn: `tsc`, `npm test`, build web và build native đều qua.

---

## Plugin sẽ dùng (đã kiểm tra tương thích Capacitor 8 + Swift Package Manager)

| Việc | Plugin | Phiên bản | Ghi chú |
|---|---|---|---|
| Lưu trữ | `@capacitor/preferences` | 8.0.1 | Chính chủ Capacitor |
| Rung | `@capacitor/haptics` | 8.0.2 | Chính chủ Capacitor |
| Nhận giọng nói | `@capgo/capacitor-speech-recognition` | 8.3.2 | **Thay cho** `@capacitor-community/speech-recognition` 7.0.1 — bản community không có `Package.swift` nên không cài được vào dự án iOS của Capacitor 8 |
| Giọng đọc dự phòng | `@capacitor-community/text-to-speech` | 8.0.2 | Có sự kiện `onRangeStart` → karaoke vẫn tô được theo từ |

---

## Bước 1 — Lớp `platform` (≈ 0,5 giờ)

**File mới:** `src/lib/platform.ts`
```ts
import { Capacitor } from '@capacitor/core'
export const isNative = () => Capacitor.isNativePlatform()
export const platform = () => Capacitor.getPlatform() // 'ios' | 'android' | 'web'
```
**Test:** `tests/platform.test.ts` — trong jsdom `isNative()` trả `false`.

---

## Bước 2 — Lưu trữ bền (≈ 2–3 giờ)

**Vấn đề:** localStorage trong WebView iOS có thể bị hệ điều hành xoá khi máy thiếu bộ nhớ → học sinh mất XP, Leitner, tên.

**Cách làm (không phải sửa logic đồng bộ hiện có):**
- localStorage vẫn là bộ nhớ đọc/ghi nhanh, đồng bộ như bây giờ.
- Trên native, mỗi lần ghi khoá `ptalk:*` thì ghi thêm sang Preferences (bộ lưu native bền).
- Khi mở app, **trước khi render**, chạy `hydrateStorage()`:
  1. Đọc mọi khoá `ptalk:*` từ Preferences → chép vào localStorage (khôi phục nếu WebView đã bị xoá).
  2. Nếu Preferences còn trống mà localStorage có dữ liệu → chép ngược sang Preferences (di chuyển một lần).

**File mới:** `src/lib/storage.ts` — `getItem`, `setItem`, `removeItem` (đồng bộ, như localStorage) + `hydrateStorage()` (async, chỉ làm gì khi native).

**File sửa (đổi `localStorage.x` → `storage.x`, logic giữ nguyên):**
| File | Khoá |
|---|---|
| `src/lib/progress.ts` | `ptalk:v1:progress` (XP, Leitner, tên) |
| `src/lib/sfx.ts` | tắt/bật âm |
| `src/games/story/data.ts` | phim/chat đã xem gần nhất, cái kết đã mở |
| `src/games/brain/Wordle.tsx` | từ Wordle gần đây |
| `src/main.tsx` | `await hydrateStorage()` trước `createRoot().render` |

**Test:** `tests/storage.test.ts` — mock Preferences: (a) web không gọi Preferences; (b) native ghi song song; (c) hydrate khôi phục khi localStorage trống; (d) hydrate di chuyển khi Preferences trống. `tests/progress.test.ts`, `tests/story.test.ts` vẫn xanh.

---

## Bước 3 — Nhận giọng nói native (≈ 4–5 giờ) — **quan trọng nhất**

**Vấn đề:** `SpeechRecognition` không tồn tại trong WebView iOS và Android → Karaoke, Boss, SpeakIt, Chat, Mission, SpeechCheck hiện rơi vào chế độ "tự chấm".

**File sửa:** `src/lib/recognition.ts` (giữ nguyên `hasRecognition()`, `listen()`, kiểu `ListenError`)
- `hasRecognition()`: native → `true` (plugin đã cài); web → như cũ.
- `listen()` native:
  1. `requestPermissions()` lần đầu; từ chối → reject `'denied'`.
  2. `start({ language: 'en-US', maxResults: 3, partialResults: false, popup: false })` → trả mảng phương án, tốt nhất trước — **cùng dạng** với web nên `scoring.ts` không đổi.
  3. `stop()` gọi `SpeechRecognition.stop()`.
  4. Map lỗi plugin → `'denied' | 'no-speech' | 'network' | 'aborted' | 'unsupported'` như web.
- `listenSafe.ts` (cầu chì 10 giây) giữ nguyên, vẫn bọc ngoài.

**Quyền (bắt buộc làm ngay bước này, thiếu là app crash khi bấm micro):**
- iOS `ios/App/App/Info.plist`:
  - `NSMicrophoneUsageDescription`: "PTalk cần micro để bạn luyện nói và chấm phát âm."
  - `NSSpeechRecognitionUsageDescription`: "PTalk chuyển giọng nói của bạn thành chữ để chấm câu nói."
- Android `android/app/src/main/AndroidManifest.xml`: `RECORD_AUDIO`, khai báo `<queries>` cho `android.speech.RecognitionService`.

**Test:** `tests/recognition.test.ts` — mock plugin: kết quả 3 phương án; từ chối quyền → `'denied'`; plugin báo không nghe thấy → `'no-speech'`; web không gọi plugin.

**Kiểm tra trên simulator:** iOS Simulator có nhận giọng nói qua micro của Mac. Chạy Karaoke bài 1, nói 1 câu, xem có chấm điểm.

---

## Bước 4 — Giọng đọc dự phòng native (≈ 2 giờ)

**Bối cảnh:** Hầu hết câu đã có mp3 Kokoro đóng gói sẵn (650 file) — chạy tốt. Giọng đọc máy chỉ dùng khi một câu không có mp3. iOS WebView có `speechSynthesis`, **Android WebView thì không**.

**File sửa:** `src/lib/speech.ts`
- `hasSynth()`: native → `true`.
- Nhánh đọc bằng máy: native → `TextToSpeech.speak({ text, lang: 'en-US', rate })` (rate: thường 1.0, chậm 0.75).
- `speakWithProgress()` native: nghe `onRangeStart` → báo `{ kind: 'char', charIndex }` như sự kiện boundary của web → karaoke tô từ không phải sửa.
- `stopSpeaking()` native → `TextToSpeech.stop()`.

**Test:** `tests/speech.test.ts` (mới, chỉ phần nhánh): native gọi plugin với đúng rate; stop gọi plugin stop.

---

## Bước 5 — Rung native (≈ 0,5 giờ)

**File sửa:** `src/lib/haptics.ts`
- Native: đúng → `Haptics.impact({ style: Light })`; sai → `Haptics.notification({ type: Error })`.
- Web: `navigator.vibrate` như cũ (iPhone trên web vẫn không rung — giới hạn của Safari).

---

## Bước 6 — Ghi âm (≈ 1 giờ kiểm tra, chỉ sửa nếu lỗi)

**Bối cảnh:** `src/lib/recorder.ts` dùng `getUserMedia` + `MediaRecorder` — WebView iOS 14.5+ và Android đều hỗ trợ khi app đã khai báo quyền micro (bước 3).

- Kiểm tra trên iOS Simulator: Mission → ghi âm → nghe lại.
- iOS trả `audio/mp4` thay vì `audio/webm`: code đã dùng `mr.mimeType` nên ổn.
- **Chỉ khi lỗi:** thêm plugin ghi âm native (`capacitor-voice-recorder`) — ghi vào kế hoạch giai đoạn 3, không làm trước.

---

## Bước 7 — Tổng kiểm tra (≈ 1 giờ)

- [ ] `npx tsc -b` sạch
- [ ] `npm test` xanh (184 cũ + test mới)
- [ ] `npm run build` (web): có service worker, có bảng giá, hành vi như cũ
- [ ] `npm run build:native` + `cap sync`: các plugin hiện trong `ios/App/CapApp-SPM/Package.swift` và `android/capacitor.settings.gradle`
- [ ] iOS Simulator:
  - [ ] Nhập tên → tắt app hẳn → mở lại: tên và XP còn
  - [ ] Karaoke bài 1: phát mp3, tô chữ, bấm micro, hiện hộp xin quyền tiếng Việt, nói → có điểm
  - [ ] Boss, Mission ghi âm + nghe lại
  - [ ] Từ chối quyền micro → app chuyển chế độ tự chấm, không crash
- [ ] Android: biên dịch được (`./gradlew assembleDebug`) — **chạy thử chỉ khi bạn đã cài Android Studio**

---

## Tổng thời gian: ≈ 1,5–2 ngày

| Bước | Ước lượng |
|---|---|
| 1. platform | 0,5 giờ |
| 2. Lưu trữ bền | 2–3 giờ |
| 3. Nhận giọng nói + quyền | 4–5 giờ |
| 4. Giọng đọc dự phòng | 2 giờ |
| 5. Rung | 0,5 giờ |
| 6. Ghi âm | 1 giờ |
| 7. Tổng kiểm tra | 1 giờ |

## Rủi ro

| Rủi ro | Xử lý |
|---|---|
| Nhận giọng nói native trả chữ khác web (viết hoa, dấu câu, số) → chấm lệch | `scoring.ts` đã chuẩn hoá chữ; nếu lệch, thêm chuẩn hoá trong nhánh native, không sửa ngưỡng |
| Plugin Capgo đổi API ở bản sau | Khoá phiên bản `8.3.x` |
| iOS Simulator nhận giọng kém (micro Mac) | Đánh giá thật ở giai đoạn 4 trên iPhone |
| Android chưa chạy được trên máy này | Chỉ kiểm tra biên dịch; chạy thật khi có Android Studio |
| `hydrateStorage` làm chậm mở app | Chỉ đọc vài khoá, < 50ms; web bỏ qua hoàn toàn |

## Không làm trong giai đoạn này
Icon, splash, safe area, nút Back Android, khoá màn hình dọc, dừng audio khi vào nền → giai đoạn 3.
