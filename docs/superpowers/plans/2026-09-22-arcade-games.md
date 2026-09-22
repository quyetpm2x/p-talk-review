# Arcade Games (Phần A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm 4 trò hành động nhiều animation vào Kho cụm từ: Bắn bóng bay, Mưa cụm từ, Chém cụm từ, Đua xe.

**Architecture:** Mỗi trò là một `GameDef` dạng `Custom` trong nhóm mới `arcade`. Khung chung `ArcadeShell` lo đếm ngược 3-2-1, HUD (mạng ❤️, điểm, combo), tạm dừng, hiệu ứng (confetti, điểm bay lên, rung màn hình, âm thanh) và kết thúc lượt → trang thống kê. Logic thuần (tạo "bom", va chạm nhát chém, vị trí xe ma, chọn đáp án) nằm trong `src/lib/arcade.ts` và có test.

**Tech Stack:** React + CSS keyframes + `requestAnimationFrame`, `canvas-confetti`, Web Audio API.

**Spec:** Thiết kế đã thống nhất trong chat (mục A của danh sách gợi ý trò chơi, 2026-09-22).

## Global Constraints

- Chạy mượt trên điện thoại, vùng chạm ≥ 44px, không cuộn ngang ở 360px.
- Màu theo nhận diện PTALK (navy `#13203f`, gold `#c9a04e`, kem), dùng token có sẵn.
- Mỗi câu trả lời gọi `record(itemId, correct)` để cập nhật Leitner.
- Kết thúc lượt gọi `finish()` với `answers` và `seconds` để hiện trang thống kê.
- Âm thanh hiệu ứng có nút tắt, lưu lựa chọn trong localStorage (bọc try/catch).
- Trò tự tạm dừng khi rời tab (`visibilitychange`).

---

## Checklist

- [x] **Task 1 — Nền tảng arcade:** `lib/arcade.ts` (+ test), `lib/sfx.ts`, `components/fx.ts` (confetti, điểm bay), `games/arcade/ArcadeShell.tsx` (đếm ngược, HUD, tạm dừng, game over), nhóm "🎮 Giải trí" trên trang Kho cụm từ.
- [x] **Task 2 — 🎈 Bắn bóng bay:** nghĩa tiếng Việt ở trên, 3 bóng chứa cụm tiếng Anh bay lên theo 3 làn; chạm đúng → nổ + confetti mini; chạm sai → xì hơi, mất mạng; bóng đúng bay mất → mất mạng; tốc độ tăng dần.
- [x] **Task 3 — ☔ Mưa cụm từ:** thẻ cụm từ rơi xuống, chạm 1 trong 5 giỏ nhóm; đúng → thẻ bay vào giỏ, giỏ nảy; sai/chạm đáy → mất mạng; rơi nhanh dần.
- [x] **Task 4 — ⚔️ Chém cụm từ:** thẻ bị tung lên theo đường parabol (đúng, nhiễu, bom sai ngữ pháp); vuốt để chém, có vệt kiếm; chém đúng → tách đôi; chém nhầm/bom → nổ, mất mạng.
- [x] **Task 5 — 🏎️ Đua xe:** trả lời nhanh 3 lựa chọn, đúng → xe tăng tốc, sai → xe xoay trượt; đua với xe ma theo kỷ lục thời gian; vạch đích + confetti.
- [x] **Task 6 — Kiểm thử & hoàn thiện:** test, build, chơi thử từng trò ở 390×844, chế độ tối, cập nhật README.
