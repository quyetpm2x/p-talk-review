# Kế hoạch triển khai: Luyện nói với AI — wav2vec2 int8 (phát âm) + Groq miễn phí (hội thoại)

> **Trạng thái 2026-10-06:** P0 ✅ (thử bằng giọng máy; chờ ghi âm thật) · P2 ✅ · P3 ✅ (chạy được trong trình duyệt; chờ đo trên iPhone = P1) · P4 ✅ phần Sổ từ + XP (màn thiết lập lần đầu gộp vào ⚙️ và màn chọn chủ đề). **P1 (đo trên máy thật) cần bạn.**

> Thiết kế & phân tích: [2026-10-06-ai-speaking.md](2026-10-06-ai-speaking.md). File này là kế hoạch làm.

## Đã chốt
| Phần | Công nghệ | Chi phí |
|---|---|---|
| Chấm phát âm | `duyentq/sonari-wav2vec2-phoneme-int8` — ONNX 355MB, int8 động, **Apache-2.0**, gốc `facebook/wav2vec2-lv-60-espeak-cv-ft`; 392 ký hiệu âm eSpeak; vào 16kHz mono chuẩn hoá | 0 — chạy trên máy học sinh |
| Hội thoại | **Groq gói miễn phí**, `llama-3.1-8b-instant` (30 lượt + 6.000 token/phút, 14.400 lượt/ngày; không huấn luyện trên dữ liệu) | 0 |
| Nghe / nói | Nhận giọng + giọng đọc **native** (đã có plugin) | 0 |

Lưu ý từ nhóm làm bản int8: **ngưỡng phải hiệu chỉnh trên chính file int8**, không dùng ngưỡng của bản gốc.

---

## Kiến trúc

```
                         ┌──────────────── App PTalk (iOS/Android/Web) ────────────────┐
 Học sinh nói ──► Mic ──►│ Nhận giọng native ──(chữ)──► Talk session ──► Giọng đọc native │
                         │        │                         │  ▲                         │
                         │        └─ PCM 16kHz ─► Pron engine (Web Worker, ONNX int8)    │
                         │                         └─► lỗi âm /θ/→/t/ theo từ            │
                         └───────────────────────────────│──┼──────────────────────────┘
                                                         ▼  │ (luồng chữ, SSE)
                                         PTalk-be (Railway) /talk/turn ─► Groq API
                                                 │ giới hạn lượt / học sinh / ngày
                                                 └─ MongoDB: talk_usage, (tuỳ chọn) bản ghi
```
- **Âm thanh không rời máy.** Lên mạng chỉ có chữ.
- Khoá Groq chỉ nằm ở Railway (`GROQ_API_KEY`); bật **Zero Data Retention** trong Groq Console.

---

## P0 — Thử chấm phát âm trên Mac (2 ngày) · CỔNG QUYẾT ĐỊNH
**Mục tiêu:** biết bản int8 có bắt đúng lỗi của người Việt không, và hiệu chỉnh ngưỡng.

Thư mục `PTalk-app/tools/pron-lab/` (Python, chỉ chạy trên máy dev, không vào app):
1. `brew install espeak-ng`; `pip install onnxruntime numpy soundfile phonemizer`.
2. `ipa.py`: câu mẫu → IPA từng từ bằng eSpeak (giọng `en-us`), **cùng bộ ký hiệu với mô hình**.
3. `score.py`:
   - đọc wav 16kHz, chuẩn hoá (mean 0, var 1), chạy ONNX → log-xác suất (khung × 392).
   - **Ép gióng CTC** chuỗi âm chuẩn vào audio (Viterbi) → đoạn thời gian của từng âm.
   - **GOP** mỗi âm = log P(âm chuẩn) − max log P(âm khác) trung bình trên đoạn.
   - **Kiểm cặp lỗi người Việt** (bảng dưới): nếu âm thay thế trong cặp áp đảo âm chuẩn vượt ngưỡng → lỗi có tên.
   - **Mất âm cuối:** đoạn của âm cuối gần như toàn `<pad>` hoặc GOP rất thấp → "mất /k/ cuối".
   - Gộp theo từ → mức **Tốt / Khá / Cần luyện**.
4. `report.py` → `report.html`: mỗi câu, từ tô màu, lỗi dạng "/θ/ trong *think* → /t/", nghe lại bản ghi.
5. **Dữ liệu thử:** 20 câu từ bài 1–2. Bạn ghi 2 lượt: (a) đọc chuẩn; (b) cố tình sai theo kịch bản tôi soạn (vd. "I tink so", bỏ âm cuối "I like i(t)", "she" → "see").
6. **Đo:** tỉ lệ bắt lỗi cố tình (mục tiêu ≥ 80%) và báo nhầm trên lượt đọc chuẩn (mục tiêu ≤ 1 lỗi/10 câu). Điều chỉnh ngưỡng từng cặp đến khi đạt.
7. **Kết quả cổng:** đạt → P2. Không đạt → báo bạn trước khi làm tiếp (phương án: chỉ giữ tầng từ, hoặc thử mô hình khác).

### Bảng cặp lỗi người Việt (v1)
| Âm chuẩn | Hay bị đọc thành | Ví dụ |
|---|---|---|
| θ | t, s | think, thank |
| ð | d, z | this, the |
| ʃ | s | she, sure |
| ʒ | z, ʃ | usually |
| z | s | is, cars |
| v | b, j | very, have |
| ɹ (đầu từ) | z, l | right |
| tʃ / dʒ | ʃ / z | chair / job |
| phụ âm cuối k t d s z | (mất) | like, it, need, cats |
| iː / ɪ, æ / ɛ | lẫn nhau | sheep/ship — **chỉ cảnh báo nhẹ, không gọi tên** |

---

## P1 — Thử chạy trên điện thoại (1 ngày) · CỔNG QUYẾT ĐỊNH
Đo trên iOS Simulator **và iPhone 15 thật** (Android khi có Android Studio):
- Tải + nạp mô hình 355MB bằng `onnxruntime-web` (WASM, chạy trong Web Worker).
- RAM tăng thêm, thời gian chấm câu 3 giây, có bị WebView kill không.
- **Mic dùng chung:** vừa nhận giọng native vừa thu PCM cho chấm phát âm cùng lúc có xung đột trên iOS không.

| Kết quả | Hướng đi |
|---|---|
| Chấm ≤ 3s, RAM ổn | Chạy trong WebView (đơn giản nhất) |
| Chậm / bị kill | Viết plugin native nhỏ dùng ONNX Runtime iOS/Android (nhanh hơn, đa luồng) — thêm ~3 ngày |
| Máy quá yếu | Dự phòng chấm trên Hugging Face Space miễn phí (gửi audio) — chỉ bật khi phụ huynh đồng ý |
| Mic xung đột | Chế độ *Bài giảng* (biết sẵn câu mẫu): chỉ thu PCM, không cần nhận giọng. Chế độ *Tự do*: chấm sau khi nói xong bằng bản ghi |

---

## P2 — Hội thoại với Groq (4–5 ngày) · làm song song với P0
### Backend `PTalk-be`
| File | Việc |
|---|---|
| `src/routes/talk.ts` | `POST /talk/turn` (cần đăng nhập): nhận `{ lessonId, mode, history[≤6], text }` → gọi Groq có streaming → trả về **SSE** từng đoạn chữ |
| `src/talk/prompt.ts` | Dựng lời nhắc hệ thống từ: chủ đề + 6–8 cụm từ khoá của bài, tên học sinh, trình độ A2, chế độ (bài giảng / tự do). Quy tắc: ≤ 2 câu ngắn, 1 câu hỏi mở, nói lại câu sai cho đúng ngay trong lời đáp, chỉ tiếng Anh |
| `src/talk/groq.ts` | Gọi `https://api.groq.com/openai/v1/chat/completions` (`stream: true`), timeout 15s, lỗi 429 → thử lại sau 1–2s tối đa 2 lần |
| `src/talk/usage.ts` | Giới hạn **80 lượt / học sinh / ngày** (collection `talk_usage`) → hết thì báo thân thiện |
| `POST /talk/summary` | Cuối phiên: tóm tắt JSON (cụm từ đã dùng, câu được sửa, từ mới) |
| Test | Groq giả: luồng SSE, cắt đúng phần JSON, 429 thử lại, vượt hạn mức, chưa đăng nhập 401 |

**Định dạng trả lời của mô hình** (để vừa nói ngay vừa có dữ liệu phụ):
```
Nice! Where in Vietnam are you from?
###
{"reply_vi":"Hay quá! Bạn ở đâu tại Việt Nam?","fix":{"said":"I from Vietnam","better":"I'm from Vietnam"},"new_words":[{"en":"hometown","vi":"quê nhà"}]}
```
Phần trước `###` stream thẳng ra loa; phần JSON đọc khi xong — hỏng thì bỏ qua, cuộc nói không bị gián đoạn.

**Biến môi trường mới trên Railway:** `GROQ_API_KEY`, `GROQ_MODEL=llama-3.1-8b-instant`, `TALK_DAILY_LIMIT=80`.

### App `PTalk-app`
| File | Việc |
|---|---|
| `src/talk/TalkPage.tsx` | Phòng nói chuyện: Cú PTALK (mấp máy khi nói), danh sách bong bóng, nút ⌨️ / 🎤 / ✨ gợi ý, nút đóng |
| `src/talk/session.ts` | Máy trạng thái: chờ → nghe → nghĩ → nói; **chạm để ngắt** khi gia sư đang nói |
| `src/talk/stream.ts` | Đọc SSE, tách câu, đẩy từng câu sang giọng đọc ngay khi đủ câu |
| `src/lib/recognition.ts` | Thêm tuỳ chọn im lặng 0,8s + chữ tạm thời gian thực cho phòng nói |
| `src/talk/Bubble.tsx` | Bong bóng gia sư: 🌐 dịch (`reply_vi`), 🔊 nghe lại; thẻ "Nói đúng hơn"; thẻ từ mới |
| `src/talk/Summary.tsx` | Tổng kết: số lượt, cụm từ của bài đã dùng, câu được sửa, từ mới, +XP |
| Lối vào | Tab **Luyện nói** trong bài (bên cạnh Cụm từ / Role-play / Ngữ pháp) + nút **Trò chuyện tự do** ở Trang chủ |
| Test | session (ngắt lời, hết lượt, mất mạng), tách câu từ luồng, phân tích phần JSON |

---

## P3 — Chấm phát âm trong app (4–5 ngày; +3 nếu P1 chọn plugin native)
| File | Việc |
|---|---|
| `tools/ipa/build-ipa.py` | Sinh IPA cho **mọi câu** của mọi bài → `src/lessons/ipa/<id>.json`; sinh từ điển IPA ~20.000 từ thường gặp → `public/ipa-dict.json` (cho chế độ tự do). eSpeak (GPL) chỉ chạy ở bước này, **không đóng vào app** |
| `src/pron/model.ts` | Tải mô hình **sau khi đăng nhập, khi có wifi**, có thanh tiến trình, lưu vào bộ nhớ app (`@capacitor/filesystem`), kiểm tra checksum; tải 1 lần |
| `src/pron/worker.ts` | Web Worker chạy ONNX (không làm đơ giao diện) |
| `src/pron/align.ts` | Ép gióng CTC (Viterbi) + GOP — **hàm thuần, có test** |
| `src/pron/diagnose.ts` | Bảng cặp lỗi + ngưỡng đã hiệu chỉnh ở P0 → lỗi theo từ, mức Tốt/Khá/Cần luyện — **có test** với ma trận xác suất mẫu lấy từ P0 |
| `src/pron/capture.ts` | Thu PCM 16kHz mono (AudioWorklet) |
| `src/pron/PronSheet.tsx` | Bảng chi tiết: câu, từ tô màu, "/θ/ trong *think* → /t/", 🔊 giọng mẫu (Kokoro) / 🔊 giọng mình, nút thử lại |
| Gắn vào | Chip **"Phát âm: Khá"** dưới mỗi lượt nói trong phòng nói chuyện; tuỳ chọn thay chấm hiện tại ở Karaoke / Mission |

---

## P4 — Từ mới, thiết lập, tích hợp (2–3 ngày)
- **Sổ từ của tôi:** từ `new_words` + câu được sửa → lưu vào tiến độ (đồng bộ máy chủ, gộp như phần còn lại) → ôn bằng **Leitner sẵn có** trong Thẻ lật / Điền từ.
- **Thiết lập lần đầu:** chủ đề quan tâm · tốc độ gia sư 0,7× / 0,9× / 1,0× / 1,2× (nghe thử) · giọng gia sư (giọng native có trên máy). Đổi lại trong sheet tài khoản.
- **XP & nhiệm vụ ngày:** mỗi phiên nói + mỗi câu "Tốt" cộng XP; nhiệm vụ mới "Nói chuyện 3 phút với Cú".

---

## Thứ tự & thời gian
| Tuần | Việc |
|---|---|
| 1 | **P0** (bạn ghi âm 20 câu × 2 lượt) ‖ **P2** backend + app hội thoại |
| 2 | **P1** đo trên iPhone → **P3** chấm phát âm trong app |
| 3 | P3 (tiếp) + **P4** + thử trên máy thật |
| **Tổng** | **≈ 3 tuần** (+3 ngày nếu cần plugin native) |

## Bạn cần chuẩn bị
1. Tài khoản **Groq** (miễn phí, không cần thẻ) → tạo API key → bật Zero Data Retention. Key dán vào Railway, không cần gửi tôi; khi phát triển đặt trong `PTalk-be/.env`.
2. **Ghi âm** cho P0: 20 câu × 2 lượt (tôi gửi danh sách + kịch bản đọc sai), file `.m4a` từ iPhone là được.
3. iPhone 15 cắm vào Mac cho P1.

## Rủi ro
| Rủi ro | Xử lý |
|---|---|
| Bản int8 bắt lỗi kém / báo nhầm nhiều | Cổng P0; chỉ gọi tên lỗi khi chắc; ngưỡng riêng từng cặp |
| Mô hình 355MB nặng với WebView / máy yếu | Cổng P1; plugin native hoặc máy chủ dự phòng; chỉ tải khi có wifi |
| Groq miễn phí nghẽn giờ cả lớp cùng nói (6.000 token/phút) | Lời nhắc gọn, nhớ 6 lượt; thử lại 429; báo "Cú đang nghĩ…"; chuyển gói trả phí rẻ nếu cần (không sửa app) |
| Llama 8B lạc chủ đề / sai định dạng | Lời nhắc chặt, câu ngắn; phần JSON hỏng thì bỏ qua; kiểm thử 30 phiên mẫu |
| Nội dung không phù hợp trẻ em | Quy tắc trong lời nhắc + lọc từ khoá đầu ra ở backend |
| Dữ liệu trẻ em (NĐ 13/2023) | Âm thanh không rời máy; Groq không lưu; điều khoản phụ huynh khi đăng ký |
