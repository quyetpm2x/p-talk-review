/** Logic thuần cho trò Đánh boss: sát thương, máu, mức khó. */

export const BOSS_HP = 100
/** Ngưỡng khớp để tính là một đòn đánh */
export const HIT_RATIO = 0.8
/** Ngưỡng khớp gần tuyệt đối → đòn chí mạng */
export const CRIT_RATIO = 0.95

/** Số đòn thường cần để hạ boss: 6 (ít cụm thì vẫn 6, các câu được hỏi lại). */
export const HITS_TO_WIN = 6

export type Strike = { damage: number; crit: boolean }

/**
 * Sát thương của một đòn.
 * - Gốc: BOSS_HP / HITS_TO_WIN (≈17).
 * - Chí mạng (khớp ≥ 95%; chế độ chọn đáp án không có chí mạng): ×1.3.
 * - Chuỗi đúng liên tiếp: +10% mỗi đòn trước đó, tối đa +30%.
 * - Có xem gợi ý: ×0.6.
 */
export function strikeDamage(o: { ratio: number; streak: number; hinted?: boolean; noCrit?: boolean }): Strike {
  const base = BOSS_HP / HITS_TO_WIN
  const crit = !o.noCrit && o.ratio >= CRIT_RATIO
  const combo = 1 + Math.min(3, Math.max(0, o.streak)) * 0.1
  const dmg = base * (crit ? 1.3 : 1) * combo * (o.hinted ? 0.6 : 1)
  return { damage: Math.max(1, Math.round(dmg)), crit }
}

/** Máu còn lại sau đòn đánh (không âm). */
export const applyDamage = (hp: number, damage: number) => Math.max(0, hp - damage)

/** Phần trăm máu để vẽ thanh máu, 0–100. */
export const hpPercent = (hp: number, max = BOSS_HP) => Math.max(0, Math.min(100, (hp / max) * 100))

/** Màu thanh máu theo lượng máu còn lại. */
export const hpTone = (hp: number, max = BOSS_HP): 'high' | 'mid' | 'low' => {
  const p = hpPercent(hp, max)
  return p > 50 ? 'high' : p > 20 ? 'mid' : 'low'
}

/** Số lượt đầu cho xem luôn câu tiếng Anh (khởi động dễ). */
export const EASY_TURNS = 2

/** Thời gian mỗi lượt (ms) trước khi boss phản đòn; có micro thì lâu hơn. */
export const turnMs = (mic: boolean, turn: number) => (mic ? 20000 : 12000) - Math.min(4000, turn * 400)

/** Tiếng kêu khi boss trúng đòn. */
export const OUCH = ['Argh!', 'Ouch!', 'Nooo!', 'Grr…!', 'Ái da!', 'Huhu!']
/** Câu khiêu khích khi boss phản đòn. */
export const TAUNT = ['Hehe!', 'Too slow!', 'Muahaha!', 'Nope!']
