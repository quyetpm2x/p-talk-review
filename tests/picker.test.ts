import { it, expect } from 'vitest'
import { phrasePool, pickItems, distractors, hardest } from '../src/lib/picker'
import lesson from '../src/lessons/level2-01.json'
import type { Lesson } from '../src/types'
const l = lesson as Lesson
const DAY = 86400000

it('phrasePool theo bộ', () => {
  expect(phrasePool(l, 'all')).toHaveLength(25)
  expect(phrasePool(l, 'surprise').every((i) => i.group === 'surprise')).toBe(true)
  const ex = phrasePool(l, 'extra')
  expect(ex).toHaveLength(20)
  expect(ex.every((i) => i.extra)).toBe(true)
})
it('pickItems ưu tiên cụm đến hạn, không trùng', () => {
  const pool = phrasePool(l, 'all')
  const stats: Record<string, any> = {}
  // tất cả trừ g1, g2 đều box 5 mới ôn → chưa đến hạn
  for (const i of pool) stats[`${l.id}:${i.id}`] = { box: 5, wrong: 0, seen: 5, last: 10 * DAY }
  delete stats[`${l.id}:g1`]
  stats[`${l.id}:g2`].box = 1
  const picked = pickItems(pool, stats, l.id, 5, 10 * DAY)
  expect(picked.slice(0, 2).map((i) => i.id).sort()).toEqual(['g1', 'g2'])
  expect(new Set(picked.map((i) => i.id)).size).toBe(5)
})
it('distractors không chứa target, không trùng giá trị, ưu tiên cùng nhóm', () => {
  const pool = phrasePool(l, 'all')
  const target = pool.find((i) => i.id === 's1')!
  for (let k = 0; k < 20; k++) {
    const d = distractors(target, pool, 3, (i) => i.en)
    expect(d).toHaveLength(3)
    expect(d.some((i) => i.id === 's1')).toBe(false)
    expect(new Set(d.map((i) => i.en)).size).toBe(3)
    expect(d.every((i) => i.group === 'surprise')).toBe(true)
  }
})
it('distractors bỏ qua item thiếu key', () => {
  const pool = phrasePool(l, 'all')
  const target = pool.find((i) => i.id === 'g3')!
  const d = distractors(target, pool, 3, (i) => i.synonym)
  expect(d.every((i) => !!i.synonym)).toBe(true)
})
it('hardest', () => {
  const pool = phrasePool(l, 'all')
  expect(hardest(pool, {}, l.id, 10)).toEqual([])
  const stats = {
    [`${l.id}:g1`]: { box: 1, wrong: 3, seen: 4, last: 0 },
    [`${l.id}:g2`]: { box: 1, wrong: 1, seen: 1, last: 0 },
    [`${l.id}:g3`]: { box: 4, wrong: 0, seen: 4, last: 0 },
  }
  expect(hardest(pool, stats, l.id, 10).map((i) => i.id)).toEqual(['g1', 'g2'])
})
