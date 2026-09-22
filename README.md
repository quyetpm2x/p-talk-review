# PTALK Review

Web app (PWA) để học sinh PTALK English ôn lại bài sau mỗi buổi học giao tiếp. Thiết kế cho điện thoại trước, không cần đăng nhập, và tiến độ được lưu ngay trên máy của học sinh.

- **Kho cụm từ:** 14 trò chia thành 4 nhóm Nhớ / Hiểu / Dùng / Tổng hợp. Có lịch ôn lặp lại ngắt quãng theo kiểu Leitner.
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
3. Chạy `npm test`. Test sẽ báo lỗi nếu file bài học thiếu trường hoặc sai cấu trúc.

Mẹo nhập dữ liệu:
- `toolkit` của mỗi câu hội thoại phải là **một đoạn nằm y nguyên trong câu**. Đó là các cụm được gạch chân trong sách.
- `blank` là từ bị ẩn trong trò Điền từ, phải nằm trong `en`.
- `intensity` (1–3) là độ bất ngờ, dùng cho trò Thang bất ngờ.
- `situation` là mô tả tình huống cho trò Hợp tình huống.
- Cụm nào thiếu các trường tuỳ chọn này thì trò tương ứng sẽ tự bỏ qua cụm đó.

## Đưa lên Vercel

Tạo project mới trên Vercel và trỏ tới repo này. Vercel tự nhận ra đây là dự án Vite, lệnh build là `npm run build`, thư mục xuất là `dist`. Web dùng HashRouter nên không cần cấu hình chuyển hướng.

## Lưu ý về giọng nói

- Phần đọc cho nghe và nhận diện giọng nói dùng Web Speech API có sẵn trong trình duyệt. Chạy tốt nhất trên Chrome Android và Safari iOS.
- Nhận diện giọng nói cần mạng. Khi không hỗ trợ hoặc chưa được cấp quyền micro, web tự chuyển sang chế độ tự chấm.
- Micro chỉ hoạt động khi web chạy qua HTTPS hoặc localhost.
