# Phòng luyện nói — 5 cải tiến UX (07/10/2026)

| # | Chức năng | Cách làm |
|---|---|---|
| 1 | Giữ để nói | Nhấn giữ micro ≥ 200ms → nghe liên tục (không tự dừng khi im lặng), thả tay → gửi ngay. Chạm nhanh → chế độ rảnh tay cũ (tự gửi sau 1,5s im lặng). `listen({ hold })` |
| 2 | Bong bóng đang nghe | Bong bóng mờ phía học sinh, chữ chạy theo lời nói + con trỏ nhấp nháy, 5 vạch sóng theo **âm lượng thật**: app = sự kiện `audioLevel` của plugin; web = Web Audio AnalyserNode. `listen({ onLevel })` |
| 3 | Karaoke khi Cú đọc | Đọc từng câu bằng `speakWithProgress` → từ đã đọc đậm, từ đang đọc tô vàng; dùng `wordTimeline/karaokeAt/wordAtChar` của trò Karaoke. Áp dụng cả khi bấm nghe lại |
| 4 | Thẻ gợi ý | Chạm 1: Cú đọc mẫu (thẻ sáng + "Chạm lần nữa để nói theo"); chạm 2: nghe học sinh nhại lại → gửi như lượt nói, chấm phát âm theo câu mẫu |
| 5 | Nút trên bong bóng Cú | [Dịch] [🔁 Nói lại] [🐢 Chậm hơn] — chậm hơn = tốc độ hiện tại − 0,25 (tối thiểu 0,6) |

Kiểm: test đơn vị cho tách từ/karaoke & listen hold; ảnh chụp 390px với Groq giả; tsc + vitest + build native.

## Đợt 2 (07/10/2026)
| # | Chức năng | Cách làm |
|---|---|---|
| A | Thẻ "Nói đúng hơn": 🔊 + 🎤 | 🎤 = lượt luyện riêng (không gửi Cú): nghe → so khớp từ với câu đúng (`compareSaid`) + chấm phát âm nếu bật → kết quả ngay trên thẻ |
| B | Từ mới gạch chân trong lời Cú | `markPhrases` tìm cụm trong câu → nút gạch chân, chạm = nghĩa + nghe; tự vào Sổ từ khi xuất hiện; chỉ còn thẻ ✨ cho từ không có trong câu |
| C | Thanh "Đã dùng x/8 cụm" | Bài giảng/Theo bài; tính lại sau mỗi câu; tăng → thanh nảy, rung, hiện tên cụm |
| D | Màu phát âm trên chữ học sinh | Chấm xong → từng từ xanh/cam/đỏ theo mức |

## Đợt 3 — Gọn màn hình, rung theo sự kiện, mục tiêu buổi nói (kế hoạch)

### 1. Cú thành avatar nhỏ
- Lượt đầu: Cú to ở giữa (như hiện tại) để chào.
- Từ lượt 2: ẩn Cú to; **Cú nhỏ 36px** đứng cạnh bong bóng Cú mới nhất (kiểu avatar app nhắn tin), vẫn mấp máy mỏ khi đang nói. Bỏ sóng âm cạnh Cú to.
- Lợi: ~90–100px chiều cao (~15%) cho tin nhắn.

### 2. Bớt chữ, gom nút
| Vị trí | Trước | Sau |
|---|---|---|
| Góc trên trái | ✕ | **Xong** (chưa nói câu nào = thoát; đã nói = tổng kết) |
| Góc trên phải | ⚙️ tốc độ | ⚙️ **tốc độ + chấm phát âm + mục tiêu buổi nói** |
| Thanh dưới | ⌨️ 🎤 ✨ + dòng trạng thái + Kết thúc + Chấm phát âm | **chỉ ⌨️ 🎤 ✨** |

### 3. Trạng thái Cú bằng lời ngắn
- Dòng nhỏ ngay dưới avatar Cú: "Cú đang nghe…" · "Cú đang nghĩ…" · "Cú đang nói…" (ẩn khi rảnh). Bỏ dòng chữ dưới micro.
- Lần đầu vào phòng: gợi ý 1 lần "Giữ 🎤 để nói" trong bong bóng chào, rồi thôi.

### 4. Rung theo sự kiện (`haptics.ts`)
| Sự kiện | App (Capacitor Haptics) | Web (`navigator.vibrate`) |
|---|---|---|
| Bắt đầu nghe | 1 nhịp vừa (impact Medium) | `[20]` |
| Gửi câu | 2 nhịp nhẹ cách 90ms | `[12, 90, 12]` |
| Dùng đúng cụm của bài / đạt mục tiêu buổi | rung "vui" (notification Success) | `[15, 50, 15, 50, 40]` |
- Rung nhẹ khi chạm nút chung vẫn giữ; tránh rung chồng (bỏ rung chạm cho nút micro).

### 5. Mục tiêu buổi nói
- Chọn trong ⚙️: **Nói 10 câu** (mặc định) hoặc **3 phút** (tính thời gian từ câu đầu tiên học sinh nói).
- Gộp với thanh cụm từ thành **một dòng gọn** ở đầu phòng: `🎯 4/10 câu  ·  📘 1/8 cụm` (2 thanh mảnh). Chế độ Free style chỉ có mục tiêu buổi.
- Đạt mục tiêu: rung vui + Cú chúc mừng + nút "Xong" sáng lên (vẫn nói tiếp được).

### 6. Chuỗi ngày luyện nói
- Dữ liệu mới trong tiến độ: `talk: { streak: { count, lastDay }, days: string[] }` — đồng bộ máy chủ, gộp 2 máy như chuỗi ngày học (ngày gần hơn thắng, cùng ngày lấy chuỗi dài hơn).
- Một ngày được tính khi buổi nói **đạt mục tiêu** (hoặc ≥ 5 câu).
- Tổng kết: "🔥 3 ngày luyện nói liên tiếp" + 7 chấm tuần này (ngày đã luyện tô vàng). Huy hiệu mới: "Nói 3 ngày liền", "Nói 7 ngày liền".

### File & test
- `TalkPage.tsx`, `talk.css`, `Mascot` (dùng lại), `haptics.ts` (`hapticListen/hapticSend/hapticWin`), `settings.ts` (`goal: '10' | '3m'`), `progress.ts` + `merge.ts` (talk streak), `badges.ts`.
- Test: mục tiêu buổi (đếm câu / phút), chuỗi ngày luyện nói (liên tiếp, đứt chuỗi, gộp 2 máy), mẫu rung theo sự kiện (web).
- Ước lượng: **~1 ngày**.
