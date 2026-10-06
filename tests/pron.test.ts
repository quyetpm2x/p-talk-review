import { it, expect, describe } from 'vitest'
import fixtures from './fixtures/pron.json'
import { ctcLoglik, diagnose, englishLogprobs, errorText, MODEL_IDS, phonesOf, sentenceLevel } from '../src/pron/core'

type Fx = { text: string; kind: string; lp: number[][]; words: { word: string; level: string; errors: { expected: string; heard: string }[] }[] }

describe('đối chiếu với bản Python (tools/pron-lab) trên audio thật của mô hình', () => {
  for (const [i, f] of (fixtures as Fx[]).entries()) {
    it(`#${i} ${f.kind === 'bad' ? 'đọc sai' : 'đọc đúng'}: ${f.text}`, () => {
      const r = diagnose(f.lp, f.text)
      expect(r.map((w) => ({ word: w.word, level: w.level, errors: w.errors.map((e) => ({ expected: e.expected, heard: e.heard })) }))).toEqual(f.words)
    })
  }
})

describe('CTC', () => {
  it('chuỗi khớp audio có log-likelihood cao hơn chuỗi lệch', () => {
    // 3 khung: chắc chắn cột 1, rồi blank, rồi cột 2
    const L = (p: number[]) => p.map(Math.log)
    const lp = [L([0.05, 0.9, 0.05]), L([0.9, 0.05, 0.05]), L([0.05, 0.05, 0.9])]
    expect(ctcLoglik(lp, [1, 2])).toBeGreaterThan(ctcLoglik(lp, [2, 1]) + 3)
    expect(ctcLoglik(lp, [1, 2, 1, 2, 1])).toBe(-1e9) // nhiều nhãn hơn số khung
  })
  it('englishLogprobs: chỉ giữ lớp tiếng Anh, mỗi khung tổng xác suất = 1', () => {
    const logits = new Float32Array(2 * 392).map((_, i) => (i % 392 === MODEL_IDS[3] ? 5 : 0))
    const lp = englishLogprobs(logits, 2)
    expect(lp).toHaveLength(2)
    expect(lp[0].reduce((s, v) => s + Math.exp(v), 0)).toBeCloseTo(1, 6)
    expect(Math.exp(lp[0][3])).toBeGreaterThan(0.5)
  })
})

it('từ điển IPA có các từ của bài học', () => {
  expect(phonesOf('think')).toEqual(['θ', 'ɪ', 'ŋ', 'k'])
  expect(phonesOf('Long')).toEqual(['l', 'ɔ', 'ŋ'])
  expect(phonesOf('xyzzy')).toBeUndefined()
})

it('câu mô tả lỗi và mức chung của câu', () => {
  expect(errorText('think', { expected: 'θ', heard: 't', llr: 3 })).toBe('âm /θ/ trong think bị đọc thành /t/')
  expect(errorText('like', { expected: 'k', heard: '', llr: 3 })).toBe('mất âm /k/ cuối like')
  expect(sentenceLevel([{ word: 'a', phones: [], known: true, level: 'Khá', errors: [] }])).toBe('Khá')
})

import { resample, toWav } from '../src/pron/capture'
it('resample 48kHz → 16kHz giữ đúng độ dài và dạng sóng', () => {
  const x = new Float32Array(4800).map((_, i) => Math.sin((2 * Math.PI * 440 * i) / 48000))
  const y = resample(x, 48000, 16000)
  expect(y.length).toBe(1600)
  expect(Math.abs(y[100] - Math.sin((2 * Math.PI * 440 * 100) / 16000))).toBeLessThan(0.02)
})
it('toWav: header WAV 16-bit mono', async () => {
  const b = toWav(new Float32Array(16000))
  expect(b.size).toBe(44 + 32000)
  expect(new TextDecoder().decode(new Uint8Array(await b.arrayBuffer()).slice(0, 4))).toBe('RIFF')
})
