/** Phần lõi thuần (không DOM) của Luyện nói — có test. */

export type TalkMeta = {
  reply: string
  reply_vi: string
  fix: { said: string; better: string } | null
  new_words: { en: string; vi: string }[]
}
import type { WordResult } from '../pron/core'
/** Kết quả chấm phát âm một câu của học sinh (âm thanh chỉ ở trên máy). */
export type TurnPron = { status: 'pending' | 'done' | 'error'; words?: WordResult[]; wavUrl?: string; /** câu đã dùng để chấm (câu mẫu khi nhại thẻ gợi ý) */ of?: string }
export type Turn = { role: 'tutor' | 'student'; text: string; meta?: TalkMeta; pron?: TurnPron }

/** Đọc luồng SSE: trả về các sự kiện trọn vẹn + phần dư chưa trọn. */
export function parseSse(buf: string): { events: { event: string; data: any }[]; rest: string } {
  const events: { event: string; data: any }[] = []
  let rest = buf
  let i: number
  while ((i = rest.indexOf('\n\n')) >= 0) {
    const block = rest.slice(0, i)
    rest = rest.slice(i + 2)
    let event = 'message', data = ''
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data += line.slice(5).trim()
    }
    try { events.push({ event, data: data ? JSON.parse(data) : null }) } catch { /* bỏ khối hỏng */ }
  }
  return { events, rest }
}

/**
 * Gom chữ đang chảy về thành từng câu để đọc ngay (không đợi hết đoạn).
 * Câu kết thúc bằng . ! ? và khoảng trắng; câu quá ngắn (vd. "Hi!") được gộp với câu sau cho tự nhiên.
 */
export class SentenceChunker {
  private buf = ''
  constructor(private onSentence: (s: string) => void, private minLen = 12) {}
  push(t: string) {
    this.buf += t
    for (;;) {
      const m = /[.!?](?=\s)/.exec(this.buf.slice(this.minLen - 1))
      if (!m) break
      const end = this.minLen - 1 + m.index + 1
      const s = this.buf.slice(0, end).trim()
      this.buf = this.buf.slice(end)
      if (s) this.onSentence(s)
    }
  }
  end() {
    const s = this.buf.trim()
    this.buf = ''
    if (s) this.onSentence(s)
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim()

/** Độ dài dãy con chung dài nhất (giữ thứ tự, cho phép thiếu/thừa chữ). */
function lcs(a: string[], b: string[]): number {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
  return dp[a.length][b.length]
}

/** Cụm từ của bài mà học sinh đã nói (≥ 75% số từ của cụm xuất hiện đúng thứ tự — chịu được nhận giọng thiếu vài chữ). */
export function phrasesUsed(studentTexts: string[], phrases: string[]): string[] {
  const said = studentTexts.map(norm)
  return phrases.filter((p) => {
    const words = norm(p).split(' ').filter(Boolean)
    if (!words.length) return false
    return said.some((s) => lcs(words, s.split(' ')) / words.length >= 0.75)
  })
}

/** Gợi ý câu trả lời: các cụm của bài chưa dùng, ưu tiên theo thứ tự trong bài. */
export function hints(phrases: string[], studentTexts: string[], n = 2): string[] {
  const used = new Set(phrasesUsed(studentTexts, phrases))
  return phrases.filter((p) => !used.has(p)).slice(0, n)
}

/** Lịch sử gửi máy chủ: 6 lượt gần nhất, chỉ chữ. */
export const historyFor = (turns: Turn[]) => turns.slice(-6).map((t) => ({ role: t.role, text: t.text.slice(0, 400), ...(t.meta?.reply_vi ? { vi: t.meta.reply_vi.slice(0, 400) } : {}) }))

// ---------- Karaoke khi Cú đọc ----------
import { karaokeAt, tokenOffsets, wordAtChar, wordTimeline } from '../games/voice/timing'
import type { SpeechProgress } from '../lib/speech'

/** Tách lời Cú thành các "từ" để hiển thị (giữ dấu câu dính theo từ) — cùng cách tách cho hiển thị và tô màu. */
export const splitWords = (text: string) => text.trim().split(/\s+/).filter(Boolean)

/**
 * Từ đang đọc trong MỘT câu, theo tiến độ đọc:
 * - 'char': vị trí ký tự (giọng máy báo chính xác) → từ chứa ký tự đó;
 * - 'time': tỉ lệ thời gian (file âm thanh / ước lượng) → mốc thời gian từng từ như trò Karaoke.
 * Trả { done: số từ đã đọc xong, now: từ đang đọc (−1 = khoảng lặng) }.
 */
export function wordProgress(sentence: string, p: SpeechProgress): { done: number; now: number } {
  const words = splitWords(sentence)
  if (!words.length) return { done: 0, now: -1 }
  if (p.kind === 'char') {
    const w = wordAtChar(tokenOffsets(p.text, words), p.charIndex)
    return { done: w, now: w }
  }
  if (p.fraction >= 1) return { done: words.length, now: -1 }
  return karaokeAt(wordTimeline(words), p.fraction)
}

// ---------- Từ mới gạch chân / so khớp câu nói lại ----------
const bare = (w: string) => w.toLowerCase().replace(/[’]/g, "'").replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '')

/**
 * Đánh dấu các cụm (từ mới) xuất hiện trong danh sách từ của câu.
 * Trả mảng cùng độ dài `words`: chỉ số cụm mà từ đó thuộc về, hoặc −1. Không phân biệt hoa thường, bỏ dấu câu ở đầu/cuối từ.
 */
export function markPhrases(words: string[], phrases: string[]): number[] {
  const out = words.map(() => -1)
  const w = words.map(bare)
  phrases.forEach((ph, pi) => {
    const p = ph.split(/\s+/).map(bare).filter(Boolean)
    if (!p.length) return
    for (let i = 0; i + p.length <= w.length; i++) {
      if (p.every((x, k) => w[i + k] === x) && out.slice(i, i + p.length).every((v) => v < 0)) {
        for (let k = 0; k < p.length; k++) out[i + k] = pi
        break // gạch chân lần xuất hiện đầu tiên
      }
    }
  })
  return out
}

/** So câu học sinh nói lại với câu đúng: từng từ của câu đúng có nói ra không (theo thứ tự). */
export function compareSaid(heard: string, target: string): { words: { word: string; ok: boolean }[]; ratio: number; pass: boolean } {
  const t = splitWords(target)
  const h = splitWords(heard).map(bare).filter(Boolean)
  let j = 0
  const words = t.map((word) => {
    const b = bare(word)
    if (!b) return { word, ok: true }
    const k = h.indexOf(b, j)
    if (k >= 0) { j = k + 1; return { word, ok: true } }
    return { word, ok: false }
  })
  const scored = words.filter((x) => bare(x.word))
  const ratio = scored.length ? scored.filter((x) => x.ok).length / scored.length : 0
  return { words, ratio, pass: ratio >= 0.85 }
}
