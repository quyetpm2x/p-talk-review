import { it, expect, describe } from 'vitest'
import { parseSse, SentenceChunker, phrasesUsed, hints, historyFor } from '../src/talk/core'

describe('parseSse', () => {
  it('tách sự kiện trọn vẹn, giữ phần dư cho lần đọc sau', () => {
    const a = parseSse('event: delta\ndata: {"t":"Hi"}\n\nevent: delta\ndata: {"t":" th')
    expect(a.events).toEqual([{ event: 'delta', data: { t: 'Hi' } }])
    const b = parseSse(a.rest + 'ere"}\n\nevent: done\ndata: {"used":1}\n\n')
    expect(b.events).toEqual([{ event: 'delta', data: { t: ' there' } }, { event: 'done', data: { used: 1 } }])
    expect(b.rest).toBe('')
  })
})

describe('SentenceChunker', () => {
  it('đọc từng câu ngay khi đủ câu, gộp câu quá ngắn', () => {
    const out: string[] = []
    const c = new SentenceChunker((s) => out.push(s))
    for (const t of ['Hi', ' An! How ', 'are you today? I am', ' fine.']) c.push(t)
    expect(out).toEqual(['Hi An! How are you today?'])
    c.end()
    expect(out).toEqual(['Hi An! How are you today?', 'I am fine.'])
  })
  it('không cắt ở dấu chấm giữa số hoặc chưa có khoảng trắng sau', () => {
    const out: string[] = []
    const c = new SentenceChunker((s) => out.push(s))
    c.push('It costs 2.5 dollars, right?'); c.end()
    expect(out).toEqual(['It costs 2.5 dollars, right?'])
  })
})

describe('phrasesUsed / hints', () => {
  const phrases = ['Long time no see!', "It's been ages!", 'What a small world!']
  it('nhận ra cụm đã nói, chịu được dấu câu, hoa thường, thiếu một chữ', () => {
    expect(phrasesUsed(['long time no see Lan', 'it been ages'], phrases)).toEqual(['Long time no see!'])
    expect(phrasesUsed(["Wow, it's been ages"], phrases)).toEqual(["It's been ages!"])
    expect(phrasesUsed(['what small world'], phrases)).toEqual(['What a small world!'])
  })
  it('gợi ý cụm chưa dùng', () => {
    expect(hints(phrases, ['long time no see'])).toEqual(["It's been ages!", 'What a small world!'])
  })
})

it('historyFor: 6 lượt gần nhất, chỉ chữ', () => {
  const turns = Array.from({ length: 9 }, (_, i) => ({ role: (i % 2 ? 'student' : 'tutor') as 'tutor' | 'student', text: `m${i}`, meta: undefined }))
  expect(historyFor(turns)).toHaveLength(6)
  expect(historyFor(turns)[0]).toEqual({ role: 'student', text: 'm3' })
})

import { addWords, removeWord, wordKey } from '../src/talk/words'
import { emptyProgress } from '../src/lib/progress'
import { mergeProgress } from '../src/lib/merge'

describe('Sổ từ của tôi', () => {
  it('thêm từ mới, bỏ trùng (khác hoa thường / dấu câu)', () => {
    let p = addWords(emptyProgress(), [{ en: 'Hometown', vi: 'quê nhà' }, { en: 'hometown!', vi: 'x' }, { en: '  ', vi: 'y' }], 100)
    expect(Object.keys(p.words)).toEqual(['hometown'])
    const same = addWords(p, [{ en: 'HOMETOWN', vi: 'z' }], 200)
    expect(same).toBe(p)
    p = removeWord({ ...p, phrases: { 'vocab:hometown': { box: 2, wrong: 0, seen: 1, last: 1 } } }, 'hometown')
    expect(p.words).toEqual({}); expect(p.phrases).toEqual({})
  })
  it('đồng bộ 2 máy: gộp sổ từ, giữ lần thêm sớm nhất', () => {
    const a = addWords(emptyProgress(), [{ en: 'hometown', vi: 'quê' }], 200)
    const b = addWords(emptyProgress(), [{ en: 'hometown', vi: 'quê nhà' }, { en: 'stressful', vi: 'căng thẳng' }], 100)
    const m = mergeProgress(a, b)
    expect(Object.keys(m.words).sort()).toEqual(['hometown', 'stressful'])
    expect(m.words.hometown.added).toBe(100)
  })
  it('wordKey', () => expect(wordKey('  Long time  no see! ')).toBe('long time no see'))
})

import { splitWords, wordProgress } from '../src/talk/core'
describe('karaoke khi Cú đọc', () => {
  const s = 'Hanoi is the capital of Vietnam.'
  it('tách từ giữ dấu câu', () => expect(splitWords(' Hi  there! ')).toEqual(['Hi', 'there!']))
  it('theo vị trí ký tự (giọng máy)', () => {
    expect(wordProgress(s, { kind: 'char', charIndex: 0, text: s })).toEqual({ done: 0, now: 0 })
    expect(wordProgress(s, { kind: 'char', charIndex: s.indexOf('capital'), text: s })).toEqual({ done: 3, now: 3 })
  })
  it('theo tỉ lệ thời gian: tăng dần, xong thì hết câu', () => {
    const a = wordProgress(s, { kind: 'time', fraction: 0.1 }), b = wordProgress(s, { kind: 'time', fraction: 0.7 })
    expect(b.done).toBeGreaterThan(a.done)
    expect(wordProgress(s, { kind: 'time', fraction: 1 })).toEqual({ done: 6, now: -1 })
  })
})

import { compareSaid, markPhrases } from '../src/talk/core'
describe('từ mới gạch chân', () => {
  it('đánh dấu cụm trong câu (hoa thường, dấu câu)', () => {
    const w = 'Long time no see! What is your hometown?'.split(' ')
    expect(markPhrases(w, ['long time no see', 'Hometown', 'missing'])).toEqual([0, 0, 0, 0, -1, -1, -1, 1])
  })
  it('chỉ gạch lần đầu, không chồng cụm', () => {
    expect(markPhrases(['see', 'you', 'see'], ['see', 'see you'])).toEqual([0, -1, -1])
  })
})
describe('so câu nói lại', () => {
  it('đúng hết → pass', () => {
    expect(compareSaid("I'm from Hue", "I'm from Hue.")).toMatchObject({ ratio: 1, pass: true })
  })
  it('thiếu từ → chỉ ra từ thiếu, không pass', () => {
    const r = compareSaid('I from Hue', "I'm from Hue")
    expect(r.words).toEqual([{ word: "I'm", ok: false }, { word: 'from', ok: true }, { word: 'Hue', ok: true }])
    expect(r.pass).toBe(false)
  })
})

import { sessionGoal } from '../src/talk/settings'
import { recordTalkDay, currentTalkStreak } from '../src/lib/progress'
describe('mục tiêu buổi nói', () => {
  it('10 câu', () => {
    expect(sessionGoal('n10', 4, 0, 0)).toMatchObject({ value: 4, target: 10, done: false, label: '4/10 câu' })
    expect(sessionGoal('n10', 12, 0, 0)).toMatchObject({ value: 10, done: true })
  })
  it('3 phút tính từ câu đầu tiên', () => {
    expect(sessionGoal('m3', 0, null, 99999)).toMatchObject({ value: 0, label: '0:00/3:00' })
    expect(sessionGoal('m3', 3, 1000, 1000 + 95_000)).toMatchObject({ value: 95, done: false, label: '1:35/3:00' })
    expect(sessionGoal('m3', 9, 0, 200_000).done).toBe(true)
  })
})
describe('chuỗi ngày luyện nói', () => {
  const D = 86400000, t0 = new Date(2026, 9, 1, 10).getTime()
  it('liên tiếp, cùng ngày không cộng, đứt chuỗi về 1', () => {
    let p = recordTalkDay(emptyProgress(), t0)
    p = recordTalkDay(p, t0 + 3600_000)
    p = recordTalkDay(p, t0 + D)
    expect(p.talk.streak.count).toBe(2)
    expect(currentTalkStreak(p, t0 + D)).toBe(2)
    expect(currentTalkStreak(p, t0 + 3 * D)).toBe(0)
    p = recordTalkDay(p, t0 + 4 * D)
    expect(p.talk.streak.count).toBe(1)
    expect(p.talk.days).toHaveLength(3)
  })
  it('gộp 2 máy: ngày gần hơn thắng, hợp các ngày', () => {
    const a = recordTalkDay(recordTalkDay(emptyProgress(), t0), t0 + D)
    const b = recordTalkDay(emptyProgress(), t0 + 2 * D)
    const m = mergeProgress(a, b)
    expect(m.talk.streak.lastDay).toBe(b.talk.streak.lastDay)
    expect(m.talk.days).toHaveLength(3)
  })
})
