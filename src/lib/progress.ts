import { cleanName } from './name'
import type { Lesson } from '../types'
import { applyAnswer, type PhraseStat } from './leitner'

/** Bộ đếm trong một ngày — dùng cho nhiệm vụ hằng ngày (reset khi sang ngày mới). */
export type DailyState = {
  /** Ngày áp dụng (dayKey), '' = chưa có */
  day: string
  plays: number
  correct: number
  arcade: number
  dialogue: number
  grammar: number
  perfect: number
  /** XP kiếm được từ các lượt chơi trong ngày (không tính thưởng nhiệm vụ) */
  xp: number
  /** Các id trò đã chơi trong ngày */
  games: string[]
  /** Các nhiệm vụ đã hoàn thành trong ngày */
  done: string[]
}

/** Thống kê tích luỹ toàn thời gian. */
export type Stats = {
  plays: number
  correct: number
  perfect: number
  dialogues: number
  /** id trò đã từng chơi, gom theo nhóm (tier) */
  playedByTier: Record<string, string[]>
  /** Số ngày đã hoàn thành đủ nhiệm vụ */
  questDays: number
}

export type Progress = {
  /** Tên người học (rỗng = chưa nhập) */
  name: string
  phrases: Record<string, PhraseStat>
  bestScores: Record<string, number>
  missions: Record<string, boolean[]>
  streak: { count: number; lastDay: string }
  /** Tổng điểm kinh nghiệm */
  xp: number
  /** id huy hiệu → thời điểm mở khoá (ms) */
  badges: Record<string, number>
  daily: DailyState
  stats: Stats
}

export const KEY = 'ptalk:v1:progress'

export const emptyDaily = (day = ''): DailyState => ({
  day, plays: 0, correct: 0, arcade: 0, dialogue: 0, grammar: 0, perfect: 0, xp: 0, games: [], done: [],
})

export const emptyStats = (): Stats => ({ plays: 0, correct: 0, perfect: 0, dialogues: 0, playedByTier: {}, questDays: 0 })

export const emptyProgress = (): Progress => ({
  name: '',
  phrases: {},
  bestScores: {},
  missions: {},
  streak: { count: 0, lastDay: '' },
  xp: 0,
  badges: {},
  daily: emptyDaily(),
  stats: emptyStats(),
})

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)

/** Gộp dữ liệu đã lưu (có thể là bản cũ, thiếu trường mới) với giá trị mặc định. */
export function normalizeProgress(raw: unknown): Progress {
  const e = emptyProgress()
  if (!isObj(raw)) return e
  const p = raw as Partial<Progress>
  return {
    ...e,
    ...p,
    name: typeof p.name === 'string' ? cleanName(p.name) : '',
    xp: typeof p.xp === 'number' && Number.isFinite(p.xp) ? p.xp : 0,
    badges: isObj(p.badges) ? (p.badges as Progress['badges']) : {},
    daily: isObj(p.daily) ? { ...e.daily, ...(p.daily as Partial<DailyState>) } : e.daily,
    stats: isObj(p.stats) ? { ...e.stats, ...(p.stats as Partial<Stats>) } : e.stats,
  }
}

export const setName = (p: Progress, name: string): Progress => ({ ...p, name: cleanName(name) })

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyProgress()
    return normalizeProgress(JSON.parse(raw))
  } catch {
    return emptyProgress()
  }
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* trình duyệt chặn lưu trữ: chạy tiếp, không lưu */
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
export const dayKey = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function bumpStreak(p: Progress, now: number): Progress {
  const today = dayKey(now)
  if (p.streak.lastDay === today) return p
  const yesterday = dayKey(new Date(now).setDate(new Date(now).getDate() - 1))
  const count = p.streak.lastDay === yesterday ? p.streak.count + 1 : 1
  return { ...p, streak: { count, lastDay: today } }
}

/** Streak hiển thị: về 0 nếu đã bỏ lỡ quá 1 ngày. */
export function currentStreak(p: Progress, now: number): number {
  const yesterday = dayKey(new Date(now).setDate(new Date(now).getDate() - 1))
  return p.streak.lastDay === dayKey(now) || p.streak.lastDay === yesterday ? p.streak.count : 0
}

export const statKey = (lessonId: string, id: string) => `${lessonId}:${id}`

export function recordAnswer(p: Progress, lessonId: string, phraseId: string, correct: boolean, now: number): Progress {
  const k = statKey(lessonId, phraseId)
  return bumpStreak({ ...p, phrases: { ...p.phrases, [k]: applyAnswer(p.phrases[k], correct, now) } }, now)
}

export function setBest(p: Progress, key: string, score: number): Progress {
  if ((p.bestScores[key] ?? -Infinity) >= score) return p
  return { ...p, bestScores: { ...p.bestScores, [key]: score } }
}

/** % tiến độ bài = trung bình box/5 của các cụm chính. */
export function lessonPercent(p: Progress, lesson: Lesson): number {
  if (!lesson.phrases.length) return 0
  const sum = lesson.phrases.reduce((s, ph) => s + (p.phrases[statKey(lesson.id, ph.id)]?.box ?? 0) / 5, 0)
  return (sum / lesson.phrases.length) * 100
}
