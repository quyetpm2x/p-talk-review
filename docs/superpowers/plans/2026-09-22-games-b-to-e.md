# Phần B → E: Nhập vai, Trí nhớ & đố vui, Nghe & nói, Lớp động lực

> Thực hiện song song bằng 4 sub-agent, mỗi agent chỉ sửa file thuộc phần của mình. Agent chính kiểm tra, ghép và commit.

**Khung dùng chung (đã làm trước khi giao việc):**
- 3 nhóm trò mới trong `src/games/types.ts`: `story` (🎬 Nhập vai), `brain` (🧠 Trí nhớ & đố vui), `voice` (🎤 Nghe & nói).
- Mỗi nhóm khai báo trò trong file riêng: `src/games/story/index.ts` (`STORY_GAMES`), `src/games/brain/index.ts` (`BRAIN_GAMES`), `src/games/voice/index.ts` (`VOICE_GAMES`), đã nối vào `registry.ts`.
- `GameDef.fullscreen`: trò chiếm toàn màn hình giống nhóm Giải trí.
- Trang Kho cụm từ ẩn nhóm chưa có trò.

## Checklist

- [x] **B — Nhập vai** (agent B): 🎬 Phim tương tác (3 lựa chọn: hợp tình huống / sai sắc thái / kém lịch sự, nét mặt 😊😐😬, thanh độ thân thiết, nhiều cái kết), 💬 Nhắn tin Zalo giả lập ("đang soạn tin…", giới hạn thời gian, chọn câu hoặc nói bằng micro). Dữ liệu kịch bản Bài 1 ở `src/lessons/stories/`, `src/lessons/chats/`.
- [x] **C — Trí nhớ & đố vui** (agent C): 🃏 Lật thẻ tìm cặp (12 thẻ, lật 3D, tính lượt), 🟩 Wordle cụm từ, 🎱 Bingo 4×4 (máy đọc bằng Kokoro, chế độ chiếu lên màn hình lớp), 🎡 Vòng quay may mắn (nhóm + nhiệm vụ nói/viết/dịch, ô ×2).
- [x] **D — Nghe & nói** (agent D): 🎶 Karaoke nhại giọng (tô chữ theo giọng Kokoro, sóng âm, chấm độ khớp), 👾 Đánh boss bằng giọng nói (thanh máu, rung, boss nổ).
- [x] **E — Lớp động lực** (agent E): 🦉 linh vật PTALK phản ứng theo kết quả, XP + cấp độ + huy hiệu, 🗺️ bản đồ hành trình trên Trang chủ, nhiệm vụ hằng ngày, pháo hoa giấy khi lập kỷ lục, âm thanh đúng/sai cho các trò thường (có nút tắt tiếng).
- [x] **Kiểm tra & ghép** (agent chính): typecheck, test, build, chạy thử từng trò ở 390×844, sửa lỗi, cập nhật README, commit.
