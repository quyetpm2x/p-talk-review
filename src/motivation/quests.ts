/** Nhiệm vụ hằng ngày — toàn hàm thuần. */
import { emptyDaily, type DailyState } from '../lib/progress'

export type QuestMetric = 'plays' | 'correct' | 'arcade' | 'dialogue' | 'grammar' | 'perfect' | 'xp' | 'games'
export type Quest = { id: string; icon: string; title: string; metric: QuestMetric; target: number }

export const QUESTS: Quest[] = [
  { id: 'play2', icon: '🎲', title: 'Chơi 2 trò bất kỳ', metric: 'plays', target: 2 },
  { id: 'play4', icon: '🎯', title: 'Hoàn thành 4 lượt chơi', metric: 'plays', target: 4 },
  { id: 'correct20', icon: '✅', title: 'Trả lời đúng 20 câu', metric: 'correct', target: 20 },
  { id: 'correct40', icon: '🧠', title: 'Trả lời đúng 40 câu', metric: 'correct', target: 40 },
  { id: 'arcade1', icon: '🎮', title: 'Chơi 1 trò Giải trí', metric: 'arcade', target: 1 },
  { id: 'dialogue1', icon: '💬', title: 'Ôn 1 hội thoại', metric: 'dialogue', target: 1 },
  { id: 'grammar1', icon: '✏️', title: 'Làm 1 bài ngữ pháp', metric: 'grammar', target: 1 },
  { id: 'perfect1', icon: '💯', title: 'Đạt 100% một lượt', metric: 'perfect', target: 1 },
  { id: 'xp150', icon: '⭐', title: 'Kiếm 150 XP', metric: 'xp', target: 150 },
  { id: 'games3', icon: '🧭', title: 'Thử 3 trò khác nhau', metric: 'games', target: 3 },
]

export const QUESTS_PER_DAY = 3

/** Băm chuỗi ngày thành số (FNV-1a) để chọn nhiệm vụ cố định theo ngày. */
function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
function rng(seed: number) {
  let a = seed || 1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 3 nhiệm vụ của một ngày — cùng ngày luôn ra cùng kết quả, không trùng chỉ số đo. */
export function questsFor(day: string): Quest[] {
  const r = rng(hash(day))
  const pool = QUESTS.slice()
  const out: Quest[] = []
  while (out.length < QUESTS_PER_DAY && pool.length) {
    const q = pool.splice(Math.floor(r() * pool.length), 1)[0]
    if (!out.some((o) => o.metric === q.metric)) out.push(q)
  }
  return out
}

/** Bộ đếm của ngày `day`: sang ngày mới thì reset. */
export const ensureDay = (d: DailyState | undefined, day: string): DailyState => (d && d.day === day ? d : emptyDaily(day))

export function questValue(q: Quest, d: DailyState): number {
  return q.metric === 'games' ? d.games.length : d[q.metric]
}

export const questPct = (q: Quest, d: DailyState) => Math.min(100, (questValue(q, d) / q.target) * 100)
