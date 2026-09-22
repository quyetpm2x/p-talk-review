import type { GameDef } from '../types'
import { Memory } from './Memory'
import { Wordle, wordleEligible } from './Wordle'
import { Bingo, bingoCandidates } from './Bingo'
import { Wheel } from './Wheel'

/** Phần C: Lật thẻ tìm cặp, Wordle, Bingo, Vòng quay */
export const BRAIN_GAMES: GameDef[] = [
  {
    id: 'memory', name: 'Lật thẻ tìm cặp', icon: '🃏', tier: 'brain',
    desc: 'Lật 2 thẻ một lần, ghép câu với nghĩa hoặc câu đồng nghĩa',
    eligible: () => true,
    lockReason: (items) => (items.length >= 3 ? null : 'Cần ít nhất 3 cụm'),
    Custom: Memory,
  },
  {
    id: 'wordle', name: 'Wordle cụm từ', icon: '🟩', tier: 'brain',
    desc: 'Đoán từ khoá bị ẩn trong cụm — 6 lượt, ô đổi màu gợi ý',
    eligible: wordleEligible,
    lockReason: (items) => (items.length >= 1 ? null : 'Bộ này không có từ khoá dài 3–8 chữ cái để đoán'),
    Custom: Wordle,
  },
  {
    id: 'bingo', name: 'Bingo trên lớp', icon: '🎱', tier: 'brain',
    desc: 'Nghe máy gọi câu, đánh dấu nghĩa trên bảng 4×4 — đủ 1 hàng là BINGO!',
    eligible: () => true,
    lockReason: (items) =>
      bingoCandidates(items).length >= 16 ? null : 'Cần ít nhất 16 cụm cho bảng 4×4 — hãy chọn bộ “Tất cả”',
    Custom: Bingo,
  },
  {
    id: 'wheel', name: 'Vòng quay may mắn', icon: '🎡', tier: 'brain',
    desc: 'Quay trúng nhóm + nhiệm vụ Nói / Viết / Dịch, có ô ⭐ ×2 điểm',
    eligible: () => true,
    lockReason: (items) => (items.length >= 1 ? null : 'Bộ này chưa có cụm nào'),
    Custom: Wheel,
  },
]
