/**
 * Điều kiện "hoàn thành bài" (mọi bài vẫn luôn mở — chỉ dùng để hiển thị trạng thái):
 * 📚 nhớ ≥ 60% cụm (mức nhớ ≥ 2) · 🎭 đóng vai 1 hội thoại ≥ 60% hoặc xong 1 mission · ✏️ đúng ≥ 70% bài tập ngữ pháp.
 */
import type { Lesson } from '../types'
import { statKey, type Progress } from './progress'

export const GOALS = { phrases: 0.6, rememberBox: 2, act: 60, grammar: 0.7 } as const

export type PartId = 'phrases' | 'roleplay' | 'grammar'
export type Part = {
  id: PartId
  icon: string
  label: string
  done: boolean
  /** 0–1 */
  progress: number
  /** Mô tả ngắn tiến độ / điều còn thiếu */
  detail: string
  /** Tab trong bài để làm phần này */
  tab: 'phrases' | 'roleplay' | 'grammar'
}
export type LessonStatus = { parts: Part[]; done: boolean; started: boolean; progress: number }

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

export function lessonStatus(p: Progress, lesson: Lesson): LessonStatus {
  const id = lesson.id
  const best = (k: string) => p.bestScores[`${id}:${k}`] ?? 0

  // 📚 Cụm từ
  const n = lesson.phrases.length
  const needP = Math.max(1, Math.ceil(n * GOALS.phrases))
  const known = lesson.phrases.filter((ph) => (p.phrases[statKey(id, ph.id)]?.box ?? 0) >= GOALS.rememberBox).length
  const phrases: Part = {
    id: 'phrases', icon: '📚', label: 'Cụm từ', tab: 'phrases',
    done: known >= needP, progress: clamp01(known / needP),
    detail: `Nhớ ${Math.min(known, needP)}/${needP} cụm`,
  }

  // 🎭 Nhập vai: đóng vai ≥ 60% hoặc xong đủ mục tiêu một mission
  const act = Math.max(0, ...lesson.dialogues.map((_, i) => best(`dlg${i}:act`)))
  const missionFrac = Math.max(0, ...lesson.missions.map((m, i) => {
    const g = p.missions[`${id}:${i}`] ?? []
    return m.goals.length ? g.filter(Boolean).length / m.goals.length : 0
  }))
  const rpDone = act >= GOALS.act || missionFrac >= 1
  const roleplay: Part = {
    id: 'roleplay', icon: '🎭', label: 'Nhập vai', tab: 'roleplay',
    done: rpDone, progress: rpDone ? 1 : clamp01(Math.max(act / GOALS.act, missionFrac) * 0.99),
    detail: rpDone ? (act >= GOALS.act ? `Đóng vai ${act}%` : 'Xong 1 mission') : act ? `Đóng vai ${act}% / cần ${GOALS.act}%` : 'Đóng vai 1 hội thoại',
  }

  // ✏️ Ngữ pháp: tổng câu đúng (điểm cao nhất của từng mục)
  const total = lesson.grammar.reduce((s, g) => s + g.exercises.length, 0)
  const needG = Math.max(1, Math.ceil(total * GOALS.grammar))
  const right = lesson.grammar.reduce((s, g, i) => s + Math.min(g.exercises.length, best(`gram${i}`)), 0)
  const grammar: Part = {
    id: 'grammar', icon: '✏️', label: 'Ngữ pháp', tab: 'grammar',
    done: right >= needG, progress: clamp01(right / needG),
    detail: `Đúng ${Math.min(right, needG)}/${needG} câu`,
  }

  const parts = [phrases, roleplay, grammar]
  const prefix = `${id}:`
  const started =
    Object.keys(p.phrases).some((k) => k.startsWith(prefix)) ||
    Object.keys(p.bestScores).some((k) => k.startsWith(prefix)) ||
    Object.entries(p.missions).some(([k, g]) => k.startsWith(prefix) && g.some(Boolean))
  return {
    parts,
    done: parts.every((x) => x.done),
    started,
    progress: parts.reduce((s, x) => s + x.progress, 0) / parts.length,
  }
}
