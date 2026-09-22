import { describe, it, expect } from 'vitest'
import {
  scoreGuess, mergeKeys, wordleKey, wordlePoints, splitAtKey,
  bingoLines, completedLines, hasBingo,
  segmentAt, spinTarget, shortGroupName,
  memoryScore, mismatchBlame, wordleRound,
} from '../src/games/brain/logic'

describe('Wordle', () => {
  const mk = (keys: string[]) => keys.map((k, i) => ({ id: `p${i}`, key: k }))
  const key = (x: { key: string }) => x.key
  it('wordleRound: ngẫu nhiên, tránh câu vừa chơi, không trùng từ khoá', () => {
    const pool = mk(['aaa', 'bbb', 'ccc', 'ddd', 'eee', 'fff', 'ggg', 'hhh', 'bbb', 'iii', 'jjj', 'kkk'])
    const recent = ['p0', 'p1', 'p2', 'p3', 'p4']
    for (let s = 0; s < 30; s++) {
      let seed = s + 1
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
      const r = wordleRound(pool, 5, recent, key, rnd)
      expect(r).toHaveLength(5)
      expect(r.some((x) => recent.includes(x.id))).toBe(false)
      expect(new Set(r.map(key)).size).toBe(5)
    }
    // Các lượt khác nhau cho ra bộ câu khác nhau
    const sets = new Set(Array.from({ length: 10 }, () => wordleRound(pool, 5, [], key).map((x) => x.id).sort().join()))
    expect(sets.size).toBeGreaterThan(1)
  })
  it('wordleRound: không đủ câu mới thì lấy lại câu cũ', () => {
    const pool = mk(['aaa', 'bbb', 'ccc', 'ddd', 'eee', 'fff'])
    const r = wordleRound(pool, 5, ['p0', 'p1', 'p2', 'p3'], key)
    expect(r).toHaveLength(5)
    expect(r.slice(0, 2).map((x) => x.id).sort()).toEqual(['p4', 'p5'])
  })
  it('chấm đúng chỗ / sai chỗ / không có', () => {
    expect(scoreGuess('ages', 'ages')).toEqual(['ok', 'ok', 'ok', 'ok'])
    expect(scoreGuess('sage', 'ages')).toEqual(['near', 'near', 'near', 'near'])
    expect(scoreGuess('todo', 'odds')).toEqual(['miss', 'near', 'ok', 'miss'])
  })
  it('chữ lặp: chỉ tô vàng đúng số lần chữ đó còn lại trong đáp án', () => {
    // đáp án "been" có 2 chữ e; đoán "eeee" → 2 xanh ở vị trí 1,2, còn lại xám
    expect(scoreGuess('eeee', 'been')).toEqual(['miss', 'ok', 'ok', 'miss'])
    // đáp án "odds" có 2 chữ d; đoán "dddd" → xanh ở 1,2; không thừa chữ d nào để tô vàng
    expect(scoreGuess('dddd', 'odds')).toEqual(['miss', 'ok', 'ok', 'miss'])
    // đáp án "small" có 2 chữ l; đoán "lolly" → l(3) xanh, còn 1 chữ l thừa → l(0) vàng, l(2) xám
    expect(scoreGuess('lolly', 'small')).toEqual(['near', 'miss', 'miss', 'ok', 'miss'])
    // chữ xanh được ưu tiên trước chữ vàng dù đứng sau
    expect(scoreGuess('sassy', 'class')).toEqual(['near', 'near', 'miss', 'ok', 'miss'])
  })
  it('bàn phím giữ màu tốt nhất', () => {
    let k = mergeKeys({}, 'sage', scoreGuess('sage', 'ages'))
    expect(k.s).toBe('near')
    k = mergeKeys(k, 'ages', scoreGuess('ages', 'ages'))
    expect(k.s).toBe('ok')
    k = mergeKeys(k, 'sxxx', ['miss', 'miss', 'miss', 'miss'])
    expect(k.s).toBe('ok')
    expect(k.x).toBe('miss')
  })
  it('từ khoá hợp lệ 3–8 chữ, chữ thường', () => {
    expect(wordleKey({ en: "It's been ages!", blank: 'ages' })).toBe('ages')
    expect(wordleKey({ en: 'Believe it or not, ...', blank: 'Believe' })).toBe('believe')
    expect(wordleKey({ en: 'What have you been up to?', blank: 'up' })).toBeNull()
    expect(wordleKey({ en: "I almost didn't recognize you!", blank: 'recognize' })).toBeNull()
  })
  it('tách câu quanh từ khoá, không ăn vào từ khác', () => {
    expect(splitAtKey("It's been ages!", 'ages')).toEqual(["It's been ", 'ages', '!'])
    expect(splitAtKey('Believe it or not, ...', 'believe')).toEqual(['', 'Believe', ' it or not, ...'])
    expect(splitAtKey('What a small world!', 'all')).toBeNull()
  })
  it('điểm theo số lượt', () => {
    expect(wordlePoints(1, true)).toBe(60)
    expect(wordlePoints(6, true)).toBe(10)
    expect(wordlePoints(6, false)).toBe(0)
  })
})

describe('Bingo', () => {
  const empty = () => Array(16).fill(false) as boolean[]
  it('có 10 đường ở bảng 4×4', () => {
    expect(bingoLines(4)).toHaveLength(10)
  })
  it('hàng ngang', () => {
    const m = empty(); [4, 5, 6, 7].forEach((i) => (m[i] = true))
    expect(hasBingo(m)).toBe(true)
    expect(completedLines(m)).toEqual([[4, 5, 6, 7]])
  })
  it('cột dọc', () => {
    const m = empty(); [2, 6, 10, 14].forEach((i) => (m[i] = true))
    expect(completedLines(m)).toEqual([[2, 6, 10, 14]])
  })
  it('hai đường chéo', () => {
    const m = empty(); [0, 5, 10, 15].forEach((i) => (m[i] = true))
    expect(completedLines(m)).toEqual([[0, 5, 10, 15]])
    const n = empty(); [3, 6, 9, 12].forEach((i) => (n[i] = true))
    expect(completedLines(n)).toEqual([[3, 6, 9, 12]])
  })
  it('thiếu 1 ô thì chưa bingo', () => {
    const m = empty(); [0, 1, 2, 5, 10, 15, 3 + 4].forEach((i) => (m[i] = true))
    m[15] = false
    expect(hasBingo(m)).toBe(false)
  })
  it('bảng đầy có đủ 10 đường', () => {
    expect(completedLines(Array(16).fill(true))).toHaveLength(10)
  })
})

describe('Vòng quay', () => {
  it('dừng đúng ô được chọn, luôn quay tới trước nhiều vòng', () => {
    let rot = 0
    for (let k = 0; k < 200; k++) {
      const idx = k % 8
      const off = ((k * 37) % 30) - 15
      const next = spinTarget(rot, idx, 8, 5, off)
      expect(next - rot).toBeGreaterThanOrEqual(5 * 360)
      expect(next - rot).toBeLessThan(6 * 360 + 22.5)
      expect(segmentAt(next, 8)).toBe(idx)
      rot = next
    }
  })
  it('lệch tâm bị giới hạn trong ô', () => {
    expect(segmentAt(spinTarget(0, 3, 8, 4, 999), 8)).toBe(3)
    expect(segmentAt(spinTarget(123.4, 0, 8, 4, -999), 8)).toBe(0)
  })
  it('ô dưới kim khi chưa xoay là ô 0, xoay ngược 1 ô là ô 1', () => {
    expect(segmentAt(0, 8)).toBe(0)
    expect(segmentAt(-45, 8)).toBe(1)
    expect(segmentAt(360 - 22.5 * 3, 8)).toBe(1)
  })
  it('rút gọn tên nhóm', () => {
    expect(shortGroupName('Kết thúc & giữ liên lạc')).toBe('Kết thúc')
    expect(shortGroupName('Hỏi thăm')).toBe('Hỏi thăm')
    expect(shortGroupName('Cập nhật về mình')).toBe('Cập nhật')
  })
})

describe('Lật thẻ', () => {
  it('điểm theo số lượt', () => {
    expect(memoryScore(6)).toBe(200)
    expect(memoryScore(10)).toBe(160)
    expect(memoryScore(40)).toBe(0)
    expect(memoryScore(4, 4)).toBe(200)
  })
  it('chỉ trách cặp đã từng thấy bạn của nó', () => {
    const partner = (k: string) => (k.endsWith('a') ? k[0] + 'b' : k[0] + 'a')
    const a = { key: '1a', pair: '1' }, b = { key: '2a', pair: '2' }
    expect(mismatchBlame(a, b, new Set(), partner)).toEqual([])
    expect(mismatchBlame(a, b, new Set(['1b']), partner)).toEqual(['1'])
    expect(mismatchBlame(a, b, new Set(['1b', '2b']), partner)).toEqual(['1', '2'])
  })
})
