import { it, expect } from 'vitest'
import { applyAnswer, isDue } from '../src/lib/leitner'
import { shuffle, sample } from '../src/lib/shuffle'
const DAY = 86400000

it('đúng tăng box, tối đa 5', () => {
  let s = applyAnswer(undefined, true, 0)
  expect(s.box).toBe(1)
  for (let i = 0; i < 10; i++) s = applyAnswer(s, true, 0)
  expect(s.box).toBe(5)
})
it('sai về box 1, tăng wrong', () => {
  const s = applyAnswer({ box: 4, wrong: 0, seen: 3, last: 0 }, false, 5)
  expect(s).toEqual({ box: 1, wrong: 1, seen: 4, last: 5 })
})
it('hạn ôn', () => {
  expect(isDue(undefined, 0)).toBe(true)
  expect(isDue({ box: 1, wrong: 0, seen: 1, last: 0 }, 0)).toBe(true)
  expect(isDue({ box: 3, wrong: 0, seen: 1, last: 0 }, DAY)).toBe(false)
  expect(isDue({ box: 3, wrong: 0, seen: 1, last: 0 }, 2 * DAY)).toBe(true)
})
it('shuffle giữ nguyên phần tử, sample không trùng', () => {
  const a = [1, 2, 3, 4, 5]
  expect(shuffle(a).sort()).toEqual(a)
  const s = sample(a, 3)
  expect(new Set(s).size).toBe(3)
  expect(sample(a, 10)).toHaveLength(5)
})
