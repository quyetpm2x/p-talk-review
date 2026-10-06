import { it, expect, describe } from 'vitest'
import { mergeProgress, hasProgress } from '../src/lib/merge'
import { emptyProgress, emptyDaily, type Progress } from '../src/lib/progress'

const P = (over: Partial<Progress>): Progress => ({ ...emptyProgress(), ...over })
const ph = (box: number, last: number, seen = 1, wrong = 0) => ({ box, last, seen, wrong })

describe('mergeProgress', () => {
  it('Leitner: mỗi cụm lấy lần ôn mới nhất, giữ cụm chỉ có ở một bên', () => {
    const a = P({ phrases: { x: ph(3, 100), y: ph(1, 50) } })
    const b = P({ phrases: { x: ph(1, 200), z: ph(2, 10) } })
    const m = mergeProgress(a, b)
    expect(m.phrases).toEqual({ x: ph(1, 200), y: ph(1, 50), z: ph(2, 10) })
  })

  it('XP lấy số lớn hơn; điểm cao nhất lớn hơn theo từng trò', () => {
    const m = mergeProgress(P({ xp: 300, bestScores: { a: 5, b: 9 } }), P({ xp: 120, bestScores: { a: 8, c: 1 } }))
    expect(m.xp).toBe(300)
    expect(m.bestScores).toEqual({ a: 8, b: 9, c: 1 })
  })

  it('nhiệm vụ: ô xong ở bên nào cũng tính', () => {
    const m = mergeProgress(P({ missions: { l1: [true, false, false] } }), P({ missions: { l1: [false, false, true, true], l2: [true] } }))
    expect(m.missions).toEqual({ l1: [true, false, true, true], l2: [true] })
  })

  it('huy hiệu: hợp lại, giữ thời điểm mở sớm nhất', () => {
    const m = mergeProgress(P({ badges: { a: 500, b: 100 } }), P({ badges: { a: 200, c: 300 } }))
    expect(m.badges).toEqual({ a: 200, b: 100, c: 300 })
  })

  it('chuỗi ngày: ngày gần hơn thắng; cùng ngày lấy chuỗi dài hơn', () => {
    expect(mergeProgress(P({ streak: { count: 9, lastDay: '2026-10-01' } }), P({ streak: { count: 2, lastDay: '2026-10-05' } })).streak)
      .toEqual({ count: 2, lastDay: '2026-10-05' })
    expect(mergeProgress(P({ streak: { count: 3, lastDay: '2026-10-05' } }), P({ streak: { count: 5, lastDay: '2026-10-05' } })).streak)
      .toEqual({ count: 5, lastDay: '2026-10-05' })
  })

  it('nhiệm vụ ngày: cùng ngày gộp bộ đếm và danh sách; khác ngày lấy ngày mới', () => {
    const d1 = { ...emptyDaily('2026-10-05'), plays: 3, xp: 40, games: ['bingo'], done: ['q1'] }
    const d2 = { ...emptyDaily('2026-10-05'), plays: 1, xp: 90, games: ['wordle', 'bingo'], done: [] }
    expect(mergeProgress(P({ daily: d1 }), P({ daily: d2 })).daily).toMatchObject({ plays: 3, xp: 90, games: ['bingo', 'wordle'], done: ['q1'] })
    const old = { ...emptyDaily('2026-10-01'), plays: 99 }
    expect(mergeProgress(P({ daily: old }), P({ daily: d2 })).daily).toEqual(d2)
  })

  it('thống kê: lớn hơn từng trường, hợp trò đã chơi theo nhóm', () => {
    const a = P({ stats: { plays: 10, correct: 5, perfect: 1, dialogues: 0, questDays: 2, playedByTier: { brain: ['wordle'] } } })
    const b = P({ stats: { plays: 4, correct: 9, perfect: 0, dialogues: 3, questDays: 1, playedByTier: { brain: ['bingo'], voice: ['boss'] } } })
    expect(mergeProgress(a, b).stats).toEqual({ plays: 10, correct: 9, perfect: 1, dialogues: 3, questDays: 2, playedByTier: { brain: ['bingo', 'wordle'], voice: ['boss'] } })
  })

  it('tên lấy theo tài khoản', () => {
    expect(mergeProgress(P({ name: 'Cũ' }), P({ name: 'Khác' }), 'An').name).toBe('An')
  })

  it('giao hoán và gộp lặp lại không đổi kết quả', () => {
    const a = P({ xp: 50, phrases: { x: ph(2, 100, 3, 1) }, badges: { a: 1 }, streak: { count: 2, lastDay: '2026-10-04' } })
    const b = P({ xp: 80, phrases: { x: ph(2, 100, 3, 2) }, missions: { m: [true] }, streak: { count: 1, lastDay: '2026-10-05' } })
    const ab = mergeProgress(a, b, 'An')
    expect(mergeProgress(b, a, 'An')).toEqual(ab)
    expect(mergeProgress(ab, b, 'An')).toEqual(ab)
  })

  it('chấp nhận dữ liệu hỏng/thiếu trường từ máy chủ', () => {
    expect(mergeProgress(null, { xp: 'x' }, 'An')).toEqual({ ...emptyProgress(), name: 'An' })
  })
})

it('hasProgress: nhận biết máy có dữ liệu học', () => {
  expect(hasProgress(emptyProgress())).toBe(false)
  expect(hasProgress({ ...emptyProgress(), name: 'An' })).toBe(false)
  expect(hasProgress({ ...emptyProgress(), xp: 10 })).toBe(true)
})
