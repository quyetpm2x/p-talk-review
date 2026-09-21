/** Đọc tiếng Anh bằng speechSynthesis của trình duyệt. */

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined

export const hasTTS = () => !!synth && typeof SpeechSynthesisUtterance !== 'undefined'

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

export type SpeakOpts = { voice?: 'A' | 'B'; slow?: boolean }

export function speak(text: string, opts: SpeakOpts = {}): Promise<void> {
  return new Promise((resolve) => {
    if (!hasTTS() || !text.trim()) return resolve()
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

export const stopSpeaking = () => synth?.cancel()
