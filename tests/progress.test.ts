import { it, expect, vi, beforeEach } from 'vitest'
import { emptyProgress, bumpStreak, recordAnswer, setBest, lessonPercent, loadProgress, saveProgress, KEY, dayKey } from '../src/lib/progress'
import lesson from '../src/lessons/level2-01.json'
import type { Lesson } from '../src/types'

const DAY = 86400000
const t0 = new Date(2026, 8, 22, 10).getTime()
beforeEach(() => localStorage.clear())

it('streak: cùng ngày giữ, hôm sau +1, cách 2 ngày về 1', () => {
  let p = bumpStreak(emptyProgress(), t0)
  expect(p.streak).toEqual({ count: 1, lastDay: dayKey(t0) })
  p = bumpStreak(p, t0 + 1000)
  expect(p.streak.count).toBe(1)
  p = bumpStreak(p, t0 + DAY)
  expect(p.streak.count).toBe(2)
  p = bumpStreak(p, t0 + 3 * DAY)
  expect(p.streak.count).toBe(1)
})
it('recordAnswer cập nhật theo key lesson:phrase', () => {
  const p = recordAnswer(emptyProgress(), 'L', 'g1', true, t0)
  expect(p.phrases['L:g1'].box).toBe(1)
  expect(p.streak.count).toBe(1)
})
it('setBest chỉ tăng', () => {
  let p = setBest(emptyProgress(), 'L:quiz', 50)
  p = setBest(p, 'L:quiz', 30)
  expect(p.bestScores['L:quiz']).toBe(50)
})
it('lessonPercent', () => {
  const l = lesson as Lesson
  let p = emptyProgress()
  expect(lessonPercent(p, l)).toBe(0)
  p = { ...p, phrases: { [`${l.id}:g1`]: { box: 5, wrong: 0, seen: 5, last: 0 } } }
  expect(lessonPercent(p, l)).toBeCloseTo(100 / 25)
})
it('lưu và đọc lại', () => {
  const p = setBest(emptyProgress(), 'x', 1)
  saveProgress(p)
  expect(loadProgress().bestScores.x).toBe(1)
  expect(localStorage.getItem(KEY)).toContain('"x":1')
})
it('localStorage lỗi → progress rỗng, không ném lỗi', () => {
  const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  expect(loadProgress()).toEqual(emptyProgress())
  spy.mockRestore()
  const spy2 = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
  expect(() => saveProgress(emptyProgress())).not.toThrow()
  spy2.mockRestore()
})
it('dữ liệu hỏng → progress rỗng', () => {
  localStorage.setItem(KEY, '{not json')
  expect(loadProgress()).toEqual(emptyProgress())
})
