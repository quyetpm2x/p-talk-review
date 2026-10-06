/** Phần lõi thuần (không DOM) của Luyện nói — có test. */

export type TalkMeta = {
  reply: string
  reply_vi: string
  fix: { said: string; better: string } | null
  new_words: { en: string; vi: string }[]
}
import type { WordResult } from '../pron/core'
/** Kết quả chấm phát âm một câu của học sinh (âm thanh chỉ ở trên máy). */
export type TurnPron = { status: 'pending' | 'done' | 'error'; words?: WordResult[]; wavUrl?: string }
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
export const historyFor = (turns: Turn[]) => turns.slice(-6).map((t) => ({ role: t.role, text: t.text.slice(0, 400) }))
