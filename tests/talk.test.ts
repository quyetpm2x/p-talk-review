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
