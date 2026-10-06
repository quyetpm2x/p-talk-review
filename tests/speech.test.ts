import { it, expect, vi, beforeEach, describe } from 'vitest'

let rangeCb: ((e: { start: number; end: number; spokenWord: string }) => void) | undefined
const TTS = {
  speak: vi.fn(async () => { rangeCb?.({ start: 6, end: 10, spokenWord: 'word' }) }),
  stop: vi.fn(async () => {}),
  addListener: vi.fn(async (_n: string, f: any) => { rangeCb = f; return { remove: async () => { rangeCb = undefined } } }),
}
let native = true
vi.mock('@capacitor-community/text-to-speech', () => ({ TextToSpeech: TTS }))
vi.mock('../src/lib/platform', () => ({ isNative: () => native, platform: () => 'android' }))

const { speak, speakWithProgress, stopSpeaking, hasTTS } = await import('../src/lib/speech')
const NO_CLIP = 'Zebra quantum xylophone unlikely sentence' // không có file mp3

beforeEach(() => { vi.clearAllMocks(); native = true; rangeCb = undefined })

describe('native (câu không có mp3)', () => {
  it('đọc bằng plugin, tiếng Anh, tốc độ thường', async () => {
    expect(hasTTS()).toBe(true)
    await speak(NO_CLIP)
    expect(TTS.speak).toHaveBeenCalledWith(expect.objectContaining({ text: NO_CLIP, lang: 'en-US', rate: 1 }))
  })

  it('chế độ chậm và vai B', async () => {
    await speak(NO_CLIP, { slow: true, voice: 'B' })
    expect(TTS.speak).toHaveBeenCalledWith(expect.objectContaining({ rate: 0.75, pitch: 1.2 }))
  })

  it('karaoke nhận vị trí từ từ sự kiện onRangeStart', async () => {
    const got: any[] = []
    await speakWithProgress(NO_CLIP, {}, (p) => got.push(p))
    expect(got).toContainEqual({ kind: 'char', charIndex: 6, text: NO_CLIP })
    expect(got.at(-1)).toEqual({ kind: 'time', fraction: 1 })
  })

  it('stopSpeaking dừng plugin', () => {
    stopSpeaking()
    expect(TTS.stop).toHaveBeenCalled()
  })
})

it('web không gọi plugin', async () => {
  native = false
  stopSpeaking()
  await speak(NO_CLIP)
  expect(TTS.speak).not.toHaveBeenCalled()
  expect(TTS.stop).not.toHaveBeenCalled()
})
