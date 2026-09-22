import { it, expect, describe } from 'vitest'
import { emptyProgress, setBest, type Progress } from '../src/lib/progress'
import { lessonStatus, GOALS } from '../src/lib/completion'
import lessonJson from '../src/lessons/level2-01.json'
import type { Lesson } from '../src/types'

const lesson = lessonJson as unknown as Lesson
/** Đặt mức nhớ (box) cho n cụm đầu tiên của bài. */
const remember = (p: Progress, n: number, box = 2): Progress => {
  const phrases = { ...p.phrases }
  lesson.phrases.slice(0, n).forEach((ph) => { phrases[`${lesson.id}:${ph.id}`] = { box, wrong: 0, seen: 1, last: 0 } })
  return { ...p, phrases }
}
const part = (p: Progress, id: string) => lessonStatus(p, lesson).parts.find((x) => x.id === id)!

describe('Điều kiện hoàn thành bài', () => {
  it('chưa làm gì: chưa bắt đầu, chưa hoàn thành, tiến độ 0', () => {
    const s = lessonStatus(emptyProgress(), lesson)
    expect(s.started).toBe(false)
    expect(s.done).toBe(false)
    expect(s.progress).toBe(0)
    expect(s.parts.map((x) => x.id)).toEqual(['phrases', 'roleplay', 'grammar'])
  })

  it('cụm từ: cần nhớ ≥ 60% cụm ở mức ≥ 2', () => {
    const need = Math.ceil(lesson.phrases.length * GOALS.phrases)
    expect(part(remember(emptyProgress(), need - 1), 'phrases').done).toBe(false)
    expect(part(remember(emptyProgress(), need), 'phrases').done).toBe(true)
    expect(part(remember(emptyProgress(), need, 1), 'phrases').done).toBe(false) // mức 1 chưa tính là nhớ
    expect(lessonStatus(remember(emptyProgress(), 1, 1), lesson).started).toBe(true)
  })

  it('nhập vai: đóng vai ≥ 60% HOẶC hoàn thành đủ mục tiêu một mission', () => {
    expect(part(setBest(emptyProgress(), `${lesson.id}:dlg0:act`, 59), 'roleplay').done).toBe(false)
    expect(part(setBest(emptyProgress(), `${lesson.id}:dlg1:act`, 60), 'roleplay').done).toBe(true)
    expect(part(setBest(emptyProgress(), `${lesson.id}:dlg0:fill`, 100), 'roleplay').done).toBe(false) // Điền cụm không tính
    const goals = lesson.missions[2].goals.map(() => true)
    expect(part({ ...emptyProgress(), missions: { [`${lesson.id}:2`]: goals } }, 'roleplay').done).toBe(true)
    expect(part({ ...emptyProgress(), missions: { [`${lesson.id}:2`]: [true, true] } }, 'roleplay').done).toBe(false)
  })

  it('ngữ pháp: tổng câu đúng (điểm cao nhất mỗi mục) ≥ 70%', () => {
    const total = lesson.grammar.reduce((s, g) => s + g.exercises.length, 0)
    const need = Math.ceil(total * GOALS.grammar)
    let p = emptyProgress()
    let left = need - 1
    lesson.grammar.forEach((g, i) => { const k = Math.min(g.exercises.length, left); left -= k; p = setBest(p, `${lesson.id}:gram${i}`, k) })
    expect(part(p, 'grammar').done).toBe(false)
    p = emptyProgress()
    left = need
    lesson.grammar.forEach((g, i) => { const k = Math.min(g.exercises.length, left); left -= k; p = setBest(p, `${lesson.id}:gram${i}`, k) })
    expect(part(p, 'grammar').done).toBe(true)
  })

  it('đủ cả 3 điều kiện mới là hoàn thành; tiến độ tăng dần', () => {
    let p = remember(emptyProgress(), lesson.phrases.length)
    const a = lessonStatus(p, lesson)
    expect(a.done).toBe(false)
    expect(a.parts.filter((x) => x.done)).toHaveLength(1)
    p = setBest(p, `${lesson.id}:dlg0:act`, 80)
    lesson.grammar.forEach((g, i) => { p = setBest(p, `${lesson.id}:gram${i}`, g.exercises.length) })
    const b = lessonStatus(p, lesson)
    expect(b.done).toBe(true)
    expect(b.progress).toBe(1)
    expect(b.progress).toBeGreaterThan(a.progress)
  })

  it('không tính tiến độ của bài khác', () => {
    const p = setBest(emptyProgress(), 'level2-02:dlg0:act', 100)
    expect(lessonStatus(p, lesson).started).toBe(false)
  })
})
