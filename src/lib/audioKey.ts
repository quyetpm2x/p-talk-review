import type { Lesson } from '../types'
import { cleanPhrase } from './scoring'

/** Giọng Kokoro mặc định cho cụm từ, câu gợi ý (hạng A). */
export const DEFAULT_VOICE = 'af_heart'

/** Câu thực sự được đọc: bỏ "..." ở cuối, gộp khoảng trắng. */
export const spokenText = (text: string) => cleanPhrase(text).replace(/\s+/g, ' ').trim()

/** Khoá tra file âm thanh trong manifest. */
export const clipKey = (text: string, voice: string) => `${voice}|${spokenText(text)}`

/** Cách đọc riêng cho từ Kokoro phát âm sai. */
const LEXICON: [RegExp, string][] = [
  [/\bPTALK\b/g, 'P-Talk'],
  [/\bIELTS\b/g, 'eye-elts'], // đọc như người bản xứ: /ˈaɪ.elts/
]

/** Văn bản đưa vào Kokoro: sửa từ đặc biệt và bỏ dấu tiếng Việt (Kokoro không hiểu). */
export function ttsInput(text: string): string {
  let t = spokenText(text)
  for (const [re, rep] of LEXICON) t = t.replace(re, rep)
  return t
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC')
}

export type Clip = { text: string; voice: string }

/** Tất cả câu có nút nghe trong một bài, kèm giọng đọc. */
export function collectClips(lesson: Lesson): Clip[] {
  const out = new Map<string, Clip>()
  const add = (text: string | undefined, voice = DEFAULT_VOICE) => {
    if (!text || !spokenText(text)) return
    out.set(clipKey(text, voice), { text: spokenText(text), voice })
  }
  for (const p of lesson.phrases) { add(p.en); add(p.synonym) }
  for (const p of lesson.extraPhrases) add(p.en)
  for (const d of lesson.dialogues) {
    for (const ln of d.lines) add(ln.text, d.voices?.[ln.speaker] ?? DEFAULT_VOICE)
    for (const w of d.newWords) add(w.en)
  }
  for (const m of lesson.missions) {
    add(m.kickoff)
    for (const h of m.hints) add(h.en)
  }
  return [...out.values()]
}
