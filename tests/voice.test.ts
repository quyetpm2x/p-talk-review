import { it, expect, describe } from 'vitest'
import {
  syllables, pauseAfter, wordTimeline, sentenceTimeline, karaokeAt, tokenOffsets, wordAtChar, karaokeLines,
} from '../src/games/voice/timing'
import { BOSS_HP, HITS_TO_WIN, strikeDamage, applyDamage, hpPercent, hpTone, turnMs } from '../src/games/voice/bossLogic'
import { displayTokens } from '../src/lib/scoring'
import type { Lesson } from '../src/types'
import lesson from '../src/lessons/level2-01.json'

const L = lesson as unknown as Lesson
const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length] }

describe('karaoke: mốc thời gian từng từ', () => {
  it('đếm âm tiết gần đúng', () => {
    expect(syllables('see')).toBe(1)
    expect(syllables('recognize')).toBe(3)
    expect(syllables('time')).toBe(1)
    expect(syllables("haven't")).toBe(2)
    expect(syllables('—')).toBe(1)
  })

  it('dấu câu tạo khoảng nghỉ', () => {
    expect(pauseAfter('see!')).toBeGreaterThan(pauseAfter('see,'))
    expect(pauseAfter('see,')).toBeGreaterThan(0)
    expect(pauseAfter('see')).toBe(0)
  })

  it('timeline tăng dần, không chồng nhau, nằm trong [lead, 1 - tail]', () => {
    const tokens = ['Long', 'time', 'no', 'see!']
    const s = wordTimeline(tokens, 0.05, 0.07)
    expect(s).toHaveLength(4)
    expect(s[0].start).toBeCloseTo(0.05)
    expect(s[3].end).toBeCloseTo(0.93)
    for (let i = 0; i < s.length; i++) {
      expect(s[i].end).toBeGreaterThan(s[i].start)
      if (i) expect(s[i].start).toBeGreaterThanOrEqual(s[i - 1].end)
    }
  })

  it('từ dài chiếm nhiều thời gian hơn từ ngắn', () => {
    const [a, b] = wordTimeline(['I', 'recognize'])
    expect(b.end - b.start).toBeGreaterThan(a.end - a.start)
  })

  it('có khoảng nghỉ sau dấu phẩy / gạch ngang đứng riêng', () => {
    const { tokens, spans } = sentenceTimeline('Oh my gosh — Hùng! Long time no see!')
    expect(tokens).toEqual(displayTokens('Oh my gosh — Hùng! Long time no see!'))
    const gapAfterGosh = spans[3].start - spans[2].end
    const gapAfterMy = spans[2].start - spans[1].end
    expect(gapAfterGosh).toBeGreaterThan(gapAfterMy)
  })

  it('karaokeAt: trước, giữa, sau', () => {
    const s = wordTimeline(['Long', 'time', 'no', 'see!'])
    expect(karaokeAt(s, 0)).toEqual({ done: 0, now: -1 })
    expect(karaokeAt(s, (s[1].start + s[1].end) / 2)).toEqual({ done: 1, now: 1 })
    expect(karaokeAt(s, s[2].end + 0.0001).done).toBe(3)
    expect(karaokeAt(s, 1)).toEqual({ done: 4, now: -1 })
  })

  it('đổi vị trí ký tự (boundary) thành chỉ số từ', () => {
    const text = "It's been ages — how have you been?"
    const tokens = displayTokens(text)
    const off = tokenOffsets(text, tokens)
    expect(off[0]).toBe(0)
    expect(wordAtChar(off, text.indexOf('how'))).toBe(3)
    expect(wordAtChar(off, text.indexOf('been?'))).toBe(tokens.length - 1)
    expect(wordAtChar(off, 0)).toBe(0)
  })
})

describe('karaoke: chọn câu', () => {
  const items = L.phrases.map((p) => ({ ...p }))

  it('chọn đủ 8 câu, không trùng, ưu tiên câu 3–15 từ không dấu tiếng Việt', () => {
    const lines = karaokeLines(L, items, 8, seq([0.1, 0.7, 0.3, 0.9]))
    expect(lines).toHaveLength(8)
    expect(new Set(lines.map((l) => l.text.toLowerCase())).size).toBe(8)
    for (const l of lines) {
      const n = displayTokens(l.text).length
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(15)
      expect(/[À-ỹ]/.test(l.text)).toBe(false)
    }
  })

  it('câu hội thoại có id tạm và không phải cụm thật; cụm toolkit giữ id gốc', () => {
    const lines = karaokeLines(L, items, 8)
    const ids = new Set(L.phrases.map((p) => p.id))
    for (const l of lines) {
      if (l.phrase) expect(ids.has(l.item.id)).toBe(true)
      else {
        expect(l.item.id).toMatch(/^dlg\d+-\d+$/)
        expect(l.kokoro).toBeTruthy()
      }
    }
    expect(lines.some((l) => l.phrase)).toBe(true)
    expect(lines.some((l) => !l.phrase)).toBe(true)
  })

  it('bộ cụm rỗng vẫn có câu hội thoại', () => {
    expect(karaokeLines(L, [], 8).length).toBe(8)
  })
})

describe('boss: sát thương và máu', () => {
  it('đòn thường ≈ 100/6, cần đúng 6 đòn thường để hạ boss', () => {
    const d = strikeDamage({ ratio: 0.85, streak: 0 }).damage
    expect(d).toBe(Math.round(BOSS_HP / HITS_TO_WIN))
    let hp = BOSS_HP, n = 0
    while (hp > 0) { hp = applyDamage(hp, d); n++ }
    expect(n).toBe(HITS_TO_WIN)
  })

  it('chí mạng khi khớp ≥ 95%, trừ chế độ chọn đáp án', () => {
    expect(strikeDamage({ ratio: 1, streak: 0 }).crit).toBe(true)
    expect(strikeDamage({ ratio: 1, streak: 0, noCrit: true }).crit).toBe(false)
    expect(strikeDamage({ ratio: 1, streak: 0 }).damage).toBeGreaterThan(strikeDamage({ ratio: 0.85, streak: 0 }).damage)
  })

  it('chuỗi đúng tăng sát thương (tối đa +30%), gợi ý làm giảm', () => {
    const base = strikeDamage({ ratio: 0.85, streak: 0 }).damage
    expect(strikeDamage({ ratio: 0.85, streak: 2 }).damage).toBeGreaterThan(base)
    expect(strikeDamage({ ratio: 0.85, streak: 10 }).damage).toBe(strikeDamage({ ratio: 0.85, streak: 3 }).damage)
    expect(strikeDamage({ ratio: 0.85, streak: 0, hinted: true }).damage).toBeLessThan(base)
  })

  it('máu không âm, phần trăm và màu thanh máu', () => {
    expect(applyDamage(10, 25)).toBe(0)
    expect(hpPercent(50)).toBe(50)
    expect(hpPercent(-5)).toBe(0)
    expect(hpTone(80)).toBe('high')
    expect(hpTone(40)).toBe('mid')
    expect(hpTone(10)).toBe('low')
  })

  it('thời gian lượt: có micro lâu hơn, giảm dần nhưng có sàn', () => {
    expect(turnMs(true, 0)).toBeGreaterThan(turnMs(false, 0))
    expect(turnMs(true, 5)).toBeLessThan(turnMs(true, 0))
    expect(turnMs(true, 100)).toBe(turnMs(true, 50))
    expect(turnMs(false, 100)).toBeGreaterThan(0)
  })
})

describe('sentenceTimeline giữ dấu câu đứng riêng để hiển thị', () => {
  it('dấu — gắn vào từ đứng trước', () => {
    const { tokens, gaps } = sentenceTimeline('No way — good for you!')
    expect(tokens).toEqual(['No', 'way', 'good', 'for', 'you!'])
    expect(gaps).toEqual(['', '—', '', '', ''])
  })
})
