# PTALK Review

Web app (PWA) để học sinh PTALK English ôn lại bài sau mỗi buổi học giao tiếp. Thiết kế cho điện thoại trước, không cần đăng nhập, và tiến độ được lưu ngay trên máy của học sinh.

- **Kho cụm từ:** 18 trò chia thành 5 nhóm, có lịch ôn lặp lại ngắt quãng theo kiểu Leitner:
  - **🎮 Giải trí** (game hành động): Bắn bóng bay, Mưa cụm từ, Chém cụm từ, Đua xe.
  - **Nhớ / Hiểu / Dùng / Tổng hợp:** 14 trò luyện tập (thẻ lật, trắc nghiệm, nối cặp, nghe, nói…).
- **Role-play:** hội thoại mẫu có 3 chế độ (Nghe / Điền cụm / Đóng vai bằng giọng nói) và thẻ nhiệm vụ có ghi âm.
- **Ngữ pháp:** giải thích ngắn kèm bài tập.

## Chạy trên máy

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # chạy test (Vitest)
npm run build     # build ra thư mục dist/
npm run preview   # chạy thử bản build
```

## Thêm bài học mới

1. Chép `src/lessons/level2-01.json` thành file mới (ví dụ `level2-02.json`), rồi sửa nội dung theo giáo trình. Cấu trúc file được mô tả trong `src/types.ts`.
2. Import file mới và thêm nó vào mảng `raw` trong `src/lessons/index.ts`.
3. Tạo giọng đọc cho bài mới: `npm run tts` (xem mục **Giọng đọc Kokoro** bên dưới).
4. Chạy `npm test`. Test sẽ báo lỗi nếu file bài học thiếu trường, sai cấu trúc, hoặc có câu chưa có file giọng đọc.

Mẹo nhập dữ liệu:
- `toolkit` của mỗi câu hội thoại phải là **một đoạn nằm y nguyên trong câu**. Đó là các cụm được gạch chân trong sách.
- `blank` là từ bị ẩn trong trò Điền từ, phải nằm trong `en`.
- `intensity` (1–3) là độ bất ngờ, dùng cho trò Thang bất ngờ.
- `situation` là mô tả tình huống cho trò Hợp tình huống.
- Cụm nào thiếu các trường tuỳ chọn này thì trò tương ứng sẽ tự bỏ qua cụm đó.

## Đưa lên Vercel

Tạo project mới trên Vercel và trỏ tới repo này. Vercel tự nhận ra đây là dự án Vite, lệnh build là `npm run build`, thư mục xuất là `dist`. Web dùng HashRouter nên không cần cấu hình chuyển hướng.

## Game hành động (🎮 Giải trí)

- Khung chung nằm ở `src/games/arcade/ArcadeShell.tsx`, gồm: đếm ngược 3-2-1, ❤️ mạng, combo (×2 từ 5 câu đúng liên tiếp, ×3 từ 10 câu), tạm dừng (tự dừng khi rời tab), tắt tiếng, điểm bay lên, rung màn hình và pháo hoa giấy.
- Âm thanh hiệu ứng tạo bằng Web Audio (`src/lib/sfx.ts`), không cần file. Lựa chọn tắt tiếng được lưu trên máy.
- **Chém cụm từ** tự tạo "💣 bom" sai ngữ pháp bằng cách đảo 2 từ liền nhau trong câu đúng, trừ 2 từ đầu câu (`makeBomb` trong `src/lib/arcade.ts`).
- **Đua xe** lưu thời gian tốt nhất của học sinh để xe ma chạy theo ở lần sau.

## Giọng đọc Kokoro

Các câu tiếng Anh được đọc bằng file MP3 tạo sẵn bằng [Kokoro-82M](https://github.com/hexgrad/kokoro) (giấy phép Apache-2.0). File nằm trong `public/audio/`, danh mục trong `src/audio/manifest.json`.

```bash
cd tools/tts && npm install && cd ../..   # lần đầu (~400MB, chỉ dùng trên máy tính)
npm run tts                               # tạo file cho câu mới, bỏ qua câu đã có
```

Cần cài `ffmpeg` (`brew install ffmpeg`).

- Giọng mặc định là `af_heart`. Hội thoại có thể chọn giọng riêng cho từng vai bằng trường `voices`, ví dụ `"voices": { "A": "am_michael", "B": "af_heart" }`. Danh sách giọng và hạng chất lượng: [VOICES.md](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md).
- Kokoro không hiểu dấu tiếng Việt, nên script tự bỏ dấu khi tạo giọng ("Tuấn" → "Tuan"). Từ cần đọc kiểu riêng thì thêm vào `LEXICON` trong `src/lib/audioKey.ts` (hiện có "PTALK" → "P-Talk").
- Sửa nội dung câu thì chạy lại `npm run tts`: file mới được tạo, file cũ không dùng nữa bị xoá.
- Câu nào chưa có file thì app tự đọc bằng giọng của trình duyệt.

## Lưu ý về giọng nói

- Nhận diện giọng nói và giọng đọc dự phòng dùng Web Speech API có sẵn trong trình duyệt. Chạy tốt nhất trên Chrome Android và Safari iOS.
- Nhận diện giọng nói cần mạng. Khi không hỗ trợ hoặc chưa được cấp quyền micro, web tự chuyển sang chế độ tự chấm.
- Micro chỉ hoạt động khi web chạy qua HTTPS hoặc localhost.
