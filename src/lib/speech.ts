/**
 * Đọc tiếng Anh: ưu tiên file MP3 tạo sẵn bằng Kokoro (src/audio/manifest.json),
 * câu nào chưa có file thì dùng speechSynthesis của trình duyệt.
 */
import manifest from '../audio/manifest.json'
import { clipKey, DEFAULT_VOICE, spokenText } from './audioKey'

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined

const hasSynth = () => !!synth && typeof SpeechSynthesisUtterance !== 'undefined'
const clips = manifest as Record<string, string>
const hasAudio = typeof Audio !== 'undefined'

/** Có cách nào để đọc không (file âm thanh hoặc giọng trình duyệt). */
export const hasTTS = () => (hasAudio && Object.keys(clips).length > 0) || hasSynth()

/** File âm thanh cho câu: đúng giọng trước, không có thì lấy giọng mặc định. */
export function clipUrl(text: string, kokoro?: string): string | undefined {
  const f = (kokoro && clips[clipKey(text, kokoro)]) || clips[clipKey(text, DEFAULT_VOICE)]
  return f ? `${import.meta.env.BASE_URL}audio/${f}` : undefined
}

// Dùng lại 1 thẻ audio để iOS giữ quyền phát sau lần chạm đầu tiên
let player: HTMLAudioElement | undefined
let endCurrent: (() => void) | undefined

const PREFERRED = ['Samantha', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Alex', 'Allison', 'Ava']

let voices: SpeechSynthesisVoice[] = []
function loadVoices() {
  if (!synth) return
  const en = synth.getVoices().filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('en'))
  const score = (v: SpeechSynthesisVoice) => {
    let s = 0
    if (v.lang.replace('_', '-') === 'en-US') s += 10
    const p = PREFERRED.findIndex((n) => v.name.includes(n))
    if (p >= 0) s += 20 - p
    if (/enhanced|premium|natural/i.test(v.name)) s += 5
    if (v.localService) s += 1
    return s
  }
  voices = en.sort((a, b) => score(b) - score(a))
}
if (synth) {
  loadVoices()
  synth.addEventListener?.('voiceschanged', loadVoices)
}

export type SpeakOpts = {
  /** Vai trong hội thoại — dùng khi đọc bằng giọng trình duyệt */
  voice?: 'A' | 'B'
  /** Giọng Kokoro (vd. am_michael); mặc định af_heart */
  kokoro?: string
  slow?: boolean
}

function playClip(url: string, slow?: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    player ??= new Audio()
    const a = player
    endCurrent?.()
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      a.onended = a.onerror = a.onpause = null
      endCurrent = undefined
      resolve(ok)
    }
    endCurrent = () => finish(true)
    a.onended = () => finish(true)
    a.onpause = () => finish(true)
    a.onerror = () => finish(false)
    a.src = url
    a.playbackRate = slow ? 0.75 : 1
    a.preservesPitch = true
    a.play().catch(() => finish(false))
  })
}

/** Đọc một câu; promise xong khi đọc xong. */
export async function speak(text: string, opts: SpeakOpts = {}): Promise<void> {
  const t = spokenText(text)
  if (!t) return
  synth?.cancel()
  const url = hasAudio ? clipUrl(t, opts.kokoro) : undefined
  if (url && (await playClip(url, opts.slow))) return
  player?.pause()
  return speakSynth(t, opts)
}

function speakSynth(text: string, opts: SpeakOpts): Promise<void> {
  return new Promise((resolve) => {
    if (!hasSynth()) return resolve()
    synth!.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = opts.slow ? 0.7 : 0.95
    if (!voices.length) loadVoices()
    const a = voices[0]
    const b = voices.find((v) => v !== a && v.lang === a?.lang) ?? a
    const v = opts.voice === 'B' ? b : a
    if (v) u.voice = v
    if (opts.voice === 'B' && b === a) u.pitch = 1.25
    let done = false
    const finish = () => { if (!done) { done = true; resolve() } }
    u.onend = finish
    u.onerror = finish
    // Phòng khi trình duyệt không bắn onend
    setTimeout(finish, 1500 + text.length * 120 * (opts.slow ? 1.5 : 1))
    synth!.speak(u)
  })
}

export const stopSpeaking = () => {
  synth?.cancel()
  player?.pause()
  endCurrent?.()
}
