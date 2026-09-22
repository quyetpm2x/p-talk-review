/** XP & cấp độ — toàn hàm thuần. */

export const XP_PER_CORRECT = 10
/** Số câu đúng tối đa được tính XP trong một lượt */
export const MAX_CORRECT_COUNTED = 20
export const FINISH_BONUS = 20
export const PERFECT_BONUS = 30
/** Trần XP của một lượt (trước khi áp trần theo ngày) */
export const MAX_PER_RUN = 250
/** Quá mức XP này trong ngày thì chỉ còn nhận 20% — chống "cày" quá nhanh */
export const DAILY_SOFT_CAP = 1500
export const OVER_CAP_RATE = 0.2
export const QUEST_REWARD = 50

export type XpBreakdown = { label: string; xp: number }
export type XpGain = { total: number; parts: XpBreakdown[]; capped: boolean }

/**
 * XP của một lượt: 10 XP/câu đúng (tối đa 20 câu) + 20 thưởng hoàn thành
 * + 30 nếu đúng 100% (lượt ≥ 5 câu). Trần 250 XP/lượt; vượt 1500 XP/ngày chỉ nhận 20%.
 */
export function calcXp(correct: number, total: number, xpToday = 0): XpGain {
  const c = Math.max(0, Math.min(correct, total || correct, MAX_CORRECT_COUNTED))
  const parts: XpBreakdown[] = []
  if (c > 0) parts.push({ label: `${Math.min(correct, MAX_CORRECT_COUNTED)} câu đúng`, xp: c * XP_PER_CORRECT })
  parts.push({ label: 'Hoàn thành lượt', xp: FINISH_BONUS })
  if (total >= 5 && correct >= total) parts.push({ label: 'Chính xác 100%', xp: PERFECT_BONUS })
  const raw = Math.min(MAX_PER_RUN, parts.reduce((s, x) => s + x.xp, 0))
  // Phần vượt trần ngày chỉ nhận 20%
  const room = Math.max(0, DAILY_SOFT_CAP - xpToday)
  const total2 = raw <= room ? raw : room + Math.round((raw - room) * OVER_CAP_RATE)
  return { total: total2, parts, capped: total2 < parts.reduce((s, x) => s + x.xp, 0) }
}

/** XP cần để đi từ cấp n lên cấp n+1: 100, 150, 200, … */
export const xpForNext = (level: number) => 100 + 50 * (level - 1)

/** Tổng XP để đạt cấp n (cấp 1 = 0 XP). */
export const xpToReach = (level: number) => {
  const k = Math.max(0, level - 1)
  return 100 * k + 25 * k * (k - 1)
}

export type LevelInfo = { level: number; floor: number; next: number; into: number; need: number; pct: number }

export function levelInfo(xp: number): LevelInfo {
  const x = Math.max(0, Math.floor(xp))
  let level = 1
  while (xpToReach(level + 1) <= x) level++
  const floor = xpToReach(level)
  const next = xpToReach(level + 1)
  return { level, floor, next, into: x - floor, need: next - floor, pct: ((x - floor) / (next - floor)) * 100 }
}

const TITLES = ['Cú non', 'Tập nói', 'Nói trôi chảy', 'Tự tin giao tiếp', 'Diễn giả nhí', 'Cao thủ hội thoại', 'Bậc thầy PTALK']
/** Danh hiệu theo cấp. */
export const levelTitle = (level: number) => TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 2))]
