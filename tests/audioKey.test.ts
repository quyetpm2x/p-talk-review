import { it, expect } from 'vitest'
import { clipKey, ttsInput, collectClips, DEFAULT_VOICE } from '../src/lib/audioKey'
import lesson from '../src/lessons/level2-01.json'
import manifest from '../src/audio/manifest.json'
import type { Lesson } from '../src/types'
import { existsSync } from 'node:fs'

it('clipKey chuẩn hoá khoảng trắng và bỏ "..." ở cuối', () => {
  expect(clipKey('Believe it or not, ...', 'af_heart')).toBe('af_heart|Believe it or not')
  expect(clipKey('  Long   time no see! ', 'af_heart')).toBe('af_heart|Long time no see!')
})
it('ttsInput sửa cách đọc tên riêng', () => {
  expect(ttsInput('Hold on... Tuấn? From PTALK?')).toBe('Hold on... Tuan? From P-Talk?')
  expect(ttsInput("Aren't you Tâm's cousin? Near Bách Khoa, Đà Nẵng")).toBe("Aren't you Tam's cousin? Near Bach Khoa, Da Nang")
  expect(ttsInput('Oh my gosh — Hùng!')).toBe('Oh my gosh — Hung!')
})
it('collectClips gom đủ câu, dùng giọng riêng cho hội thoại', () => {
  const clips = collectClips(lesson as Lesson)
  expect(clips.some((c) => c.text === 'Long time no see!' && c.voice === DEFAULT_VOICE)).toBe(true)
  const d = (lesson as Lesson).dialogues[0]
  const line = d.lines[0]
  expect(clips.some((c) => c.text === line.text && c.voice === d.voices?.[line.speaker])).toBe(true)
  expect(new Set(clips.map((c) => clipKey(c.text, c.voice))).size).toBe(clips.length)
})
it('mọi câu của bài 1 đều đã có file âm thanh (chạy `npm run tts` nếu lỗi)', () => {
  const m = manifest as Record<string, string>
  const missing = collectClips(lesson as Lesson).filter((c) => !m[clipKey(c.text, c.voice)])
  expect(missing.map((c) => c.text)).toEqual([])
  for (const f of Object.values(m)) expect(existsSync(`public/audio/${f}`)).toBe(true)
})
