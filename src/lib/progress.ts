import type { Lesson } from '../types'
import { applyAnswer, type PhraseStat } from './leitner'

export type Progress = {
  phrases: Record<string, PhraseStat>
  bestScores: Record<string, number>
  missions: Record<string, boolean[]>
  streak: { count: number; lastDay: string }
}

export const KEY = 'ptalk:v1:progress'

export const emptyProgress = (): Progress => ({
  phrases: {},
  bestScores: {},
  missions: {},
  streak: { count: 0, lastDay: '' },
})

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyProgress()
    const p = JSON.parse(raw)
    return { ...emptyProgress(), ...p }
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
