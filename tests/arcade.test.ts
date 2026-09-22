import { it, expect } from 'vitest'
import { makeBomb, segmentHitsRect, ghostSteps, levelSpeed } from '../src/lib/arcade'
import { normalize } from '../src/lib/scoring'

const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length] }

it('makeBomb đảo 2 từ liền nhau, khác câu gốc', () => {
  const b = makeBomb('How have you been?', seq([0.3]))!
  expect(b).not.toBe('How have you been?')
  expect(normalize(b).sort()).toEqual(normalize('How have you been?').sort())
  expect(normalize(b).join(' ')).not.toBe(normalize('How have you been?').join(' '))
})
it('makeBomb giữ dấu câu cuối và viết hoa chữ đầu', () => {
  for (let k = 0; k < 20; k++) {
    const b = makeBomb("It's been ages!")!
    expect(b.endsWith('!')).toBe(true)
    expect(b[0]).toBe(b[0].toUpperCase())
  }
})
it('makeBomb không đảo 2 từ đầu câu', () => {
  for (let k = 0; k < 20; k++) expect(makeBomb("You haven't changed a bit!")!.startsWith('You ')).toBe(true)
})
it('makeBomb trả undefined với cụm quá ngắn', () => {
  expect(makeBomb('Actually, ...')).toBeUndefined()
  expect(makeBomb('No way!')).toBeUndefined()
})
it('segmentHitsRect', () => {
  const r = { left: 10, top: 10, right: 50, bottom: 30 }
  expect(segmentHitsRect({ x: 0, y: 20 }, { x: 60, y: 20 }, r)).toBe(true) // cắt ngang
  expect(segmentHitsRect({ x: 20, y: 15 }, { x: 25, y: 18 }, r)).toBe(true) // nằm trong
  expect(segmentHitsRect({ x: 0, y: 0 }, { x: 60, y: 5 }, r)).toBe(false) // phía trên
  expect(segmentHitsRect({ x: 0, y: 40 }, { x: 40, y: 0 }, r)).toBe(true) // chéo qua góc
})
it('ghostSteps: xe ma tiến từng bước theo thời gian, dừng ở đích', () => {
  expect(ghostSteps(0, 20000, 10)).toBe(0)
  expect(ghostSteps(19999, 20000, 10)).toBe(0)
  expect(ghostSteps(20000, 20000, 10)).toBe(1)
  expect(ghostSteps(59000, 20000, 10)).toBe(2)
  expect(ghostSteps(10 ** 7, 20000, 10)).toBe(10)
})
it('levelSpeed tăng dần nhưng có trần', () => {
  expect(levelSpeed(0)).toBeLessThan(levelSpeed(5))
  expect(levelSpeed(100)).toBe(levelSpeed(1000))
})
