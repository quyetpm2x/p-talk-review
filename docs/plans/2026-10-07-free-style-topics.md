# Free style theo chủ đề + từ vựng chuyên ngành (kế hoạch, 07/10/2026)

**Đối tượng:** người lớn, người đi làm (không phải trẻ em). Trình độ mục tiêu B1–B2.

**Mục tiêu:** Free style → chọn chủ đề (→ chọn bối cảnh) → Cú nói xoay quanh chủ đề đó, dùng từ vựng của ngành và từ chuyên sâu, học sinh được tạo cơ hội dùng lại các từ đó.

## Hiện trạng (lúc viết)
- Trang chủ (`/talk/free`) đã có lưới chọn 11 chủ đề (`TOPICS` trong `src/talk/settings.ts`), nhưng BE chỉ nhận một dòng `Topic: technology and games` + "Chat naturally" → AI nói chung chung, hay lạc đề.
- Vào từ bài học: thẻ **Free style** đi thẳng `topic = 'daily'`, không có bước chọn chủ đề (`TalkPage.tsx`, khối `if (!topic && lesson)`).
- `new_words` (0–2 từ/lượt) do AI tự chọn, không bám chủ đề.
- Lời nhắc (`PTalk-be/src/talk/prompt.ts`) khoá cứng cho trẻ em: `level A2`, `simple English (A2-B1)`, `safe for children`, `max 35 words`, giọng "friendly classmate".

## Danh sách chủ đề (thay `TOPICS`)
Bỏ **Tin tức** (AI không biết thời sự, dễ bịa). **Sức khoẻ** chỉ ở mức đơn giản, **không tư vấn thuốc / điều trị**.

| id | Chủ đề | Bối cảnh gợi ý |
|---|---|---|
| daily | 💬 Nói gì cũng được | (giữ như cũ, học sinh dẫn dắt) |
| work | 💼 Công việc | Giới thiệu công việc · Họp nhóm · Xin nghỉ phép |
| interview | 🤝 Phỏng vấn xin việc | Giới thiệu bản thân · Điểm mạnh/yếu · Hỏi về lương, phúc lợi |
| tech | 📱 Công nghệ | Mua điện thoại · Nói về AI · Sửa máy tính |
| dreams | 💭 Ước mơ & mục tiêu | Nghề mơ ước · Kế hoạch 5 năm · Du học |
| study | 🏫 Học tập | Học thêm khoá học · Kỷ niệm thời đi học |
| pets | 🐶 Thú cưng | Nuôi chó mèo · Đưa thú cưng đi khám |
| health | 🩺 Sức khoẻ cơ bản | Đi khám · Kể triệu chứng · Tập thể dục · Giấc ngủ |
| travel | ✈️ Du lịch | Đặt phòng · Hỏi đường · Ở sân bay |
| food | 🍜 Ẩm thực | Gọi món · Nấu ăn |
| shopping | 🛍️ Mua sắm | Mặc cả · Đổi trả hàng |
| home | 🏠 Nhà cửa | Thuê nhà · Hàng xóm |
| money | 💰 Tài chính cá nhân | Tiết kiệm · Ngân hàng |
| family | 👨‍👩‍👧 Gia đình & bạn bè | Giới thiệu gia đình · Cuối tuần |
| hobbies | 🎨 Sở thích | Phim · Nhạc · Thể thao |

## Thiết kế

### Luồng màn hình
```
Free style → Chọn chủ đề (lưới icon) → [Chọn bối cảnh — có nút "Bỏ qua"] → Phòng nói
```
- Dùng lại lưới chủ đề sẵn có; ô đầu vẫn là "💬 Nói gì cũng được".
- Công tắc **Cơ bản / Chuyên sâu** ở màn chọn bối cảnh (lưu trong `TalkSettings`).
- Free style từ bài học cũng đi qua màn chọn chủ đề thay vì vào thẳng `daily`.

### Kho từ vựng theo chủ đề (cốt lõi)
- File nội dung `src/talk/vocab/<topic>.ts`: mỗi chủ đề/bối cảnh 30–40 từ/cụm, chia 2 nhóm:
  - **Cơ bản** (A2–B1), vd tech: `smartphone, charge, screen, app, download`
  - **Chuyên sâu** (B1–B2), vd tech: `artificial intelligence, battery life, data privacy, upgrade, software update`
- Soạn nháp bằng AI một lần → người duyệt → lưu tĩnh trong app (giống `lessons/`).
- Mỗi buổi gửi **8–10 từ mục tiêu**, ưu tiên từ chưa dùng (dựa vào `src/talk/words.ts` / `addWords`). Thêm ~80 token/lượt.

### Lời nhắc (BE)
Thêm nhánh riêng cho "tự do theo chủ đề – người lớn", ý chính:
> You are talking with a Vietnamese working adult (level B1–B2). Situation: {scene}. Target words: X, Y, Z… In each reply, naturally use 1–2 target words and create chances for the learner to say them. Deep level: when you use a technical term, explain it in one short simple-English sentence. `new_words` must come from the target list. If the learner drifts off topic, answer briefly then bridge back. Health topic: general talk only, never give medical advice or name medicines/doses.

- Bỏ `safe for children`, `friendly classmate`; nâng giới hạn từ `max 35 words` → ~60 từ.
- Giữ nguyên định dạng `reply ### {json}` và `FORMAT_REMINDER`.

### Đo kết quả
- Dùng lại `markPhrases` / `phrasesUsed` để gạch chân từ mục tiêu trong bong bóng.
- Thanh tiến độ "📘 3/10 từ" (như thanh cụm từ của bài).
- Màn tổng kết: từ đã nói được · từ nên ôn; đưa vào Sổ từ.

## Thay đổi kỹ thuật
**BE** — `src/talk/prompt.ts`
- `turnSchema`: thêm `scene?: string` (≤ 80), `vocab?: string[]` (≤ 12, mỗi từ ≤ 60), `depth?: 'basic' | 'deep'`, `audience?: 'adult'`.
- `systemPrompt`: nhánh mới như trên; `summaryMessages`: thêm "Target words" để tổng kết từ đã dùng.
- Test vitest cho schema + nội dung lời nhắc.

**App**
- `settings.ts`: `TOPICS` mới (thêm `scenes[]`), `TalkSettings.depth`.
- `talk/vocab/*.ts`: kho từ; hàm chọn 8–10 từ mục tiêu.
- `TalkPage.tsx`: màn chọn bối cảnh + công tắc độ sâu; Free style từ bài học → màn chọn chủ đề; `TurnBody` gửi `scene/vocab/depth`.
- `api.ts`: mở rộng `TurnBody`.

## AI & hạ tầng (kiểm tra trước khi làm)
- **Mô hình:** mặc định code là `qwen/qwen3.8-27b` — đủ khả năng. `.env` local đang để `llama-3.1-8b-instant` (Groq đã gỡ, lại yếu) → đổi `GROQ_MODEL`. Kiểm tra biến môi trường trên Railway (production).
- **Hạn mức Groq miễn phí** ~6.000 token/phút **dùng chung mọi người dùng**; 1 lượt ≈ 800–1.000 token → chỉ ~6–7 lượt/phút toàn hệ thống. Có danh sách từ + câu dài hơn sẽ tốn thêm ~20–30%. → Lên gói trả phí trước khi mở rộng người dùng.
- **Reasoning:** Qwen đang bật `reasoning_effort` mặc định (`defaultReasoning` trong `config.ts`) → chậm + tốn token. Với hội thoại nên tắt / để mức thấp nhất.

## Lộ trình
1. **Đợt 1 (~0,5 ngày):** `TOPICS` mới, Free style qua màn chọn chủ đề, nhánh lời nhắc người lớn B1–B2 + bộ từ khoá ngắn mỗi chủ đề (viết thẳng trong prompt/TOPICS).
2. **Đợt 2 (~1–2 ngày + soạn nội dung):** kho từ 2 mức, gạch chân + thanh "x/10 từ", tổng kết từ vựng.
3. **Đợt 3:** bối cảnh con, ưu tiên từ chưa thuộc khi chọn từ mục tiêu.

Kiểm: vitest BE (schema, prompt), test đơn vị chọn từ mục tiêu; thử thật với Groq từng chủ đề (bám chủ đề, dùng đúng từ, không phá định dạng `###`); tsc + build.
