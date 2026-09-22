/**
 * Logic thuần cho trò Karaoke: ước lượng mốc thời gian từng từ trong câu
 * và chọn câu để luyện. Không đụng tới DOM để test được.
 */
import type { Lesson } from '../../types'
import type { Item } from '../../lib/picker'
import { cleanPhrase, displayTokens } from '../../lib/scoring'
import { shuffle, type Rnd } from '../../lib/shuffle'

/** Ước lượng số âm tiết của một từ tiếng Anh (đếm cụm nguyên âm). */
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return /\d/.test(word) ? Math.max(1, word.replace(/\D/g, '').length) : 1
  const groups = w.replace(/e$/, '').match(/[aeiouy]+/g)
  return Math.max(1, groups?.length ?? 1)
}

/** Độ dài ngắt nghỉ sau từ (tính theo "âm tiết") dựa vào dấu câu cuối từ. */
export function pauseAfter(token: string): number {
  if (/[.!?]["”’)]*$/.test(token)) return 1.2
  if (/(—|–|-|…|\.\.\.)$/.test(token)) return 1
  if (/[,;:]["”’)]*$/.test(token)) return 0.7
  return 0
}

export type Span = { start: number; end: number }

/**
 * Mốc bắt đầu/kết thúc của từng từ theo tỉ lệ 0–1 trên tổng thời lượng audio.
 * Mỗi từ nặng bằng số âm tiết + 0.35 (phụ âm, nối âm); dấu câu thêm khoảng nghỉ.
 * `lead`/`tail`: phần im lặng ước lượng ở đầu và cuối file.
 */
export function wordTimeline(tokens: string[], lead = 0.05, tail = 0.07, gaps: string[] = []): Span[] {
  if (!tokens.length) return []
  const w = tokens.map((t) => syllables(t) + 0.35)
  // gaps[i]: ký hiệu đứng riêng sau từ i (vd. "gosh — Hùng" → "—"), cũng tạo khoảng nghỉ
  const p = tokens.map((t, i) => (i < tokens.length - 1 ? pauseAfter(t) + (gaps[i] ? pauseAfter(gaps[i]) : 0) : 0))
  const total = w.reduce((a, b) => a + b, 0) + p.reduce((a, b) => a + b, 0)
  const span = 1 - lead - tail
  const out: Span[] = []
  let acc = 0
  tokens.forEach((_, i) => {
    const start = lead + (acc / total) * span
    acc += w[i]
    const end = lead + (acc / total) * span
    acc += p[i]
    out.push({ start, end })
  })
  return out
}

/**
 * Tách câu thành các từ hiển thị kèm khoảng nghỉ thêm (do ký hiệu đứng riêng như — ở giữa).
 * Trả về tokens và timeline.
 */
export function sentenceTimeline(text: string): { tokens: string[]; spans: Span[]; gaps: string[] } {
  const raw = text.split(/\s+/).filter(Boolean)
  const tokens: string[] = []
  const gaps: string[] = []
  for (const r of raw) {
    if (/[\p{L}\p{N}]/u.test(r)) { tokens.push(r); gaps.push('') }
    else if (gaps.length) gaps[gaps.length - 1] += r
  }
  // gaps[i]: dấu câu đứng riêng sau từ i (vd. "—") — vẫn hiển thị cùng từ đó
  return { tokens, spans: wordTimeline(tokens, 0.05, 0.07, gaps), gaps }
}

/**
 * Trạng thái karaoke tại thời điểm `fraction`: số từ đã đọc xong (`done`)
 * và từ đang đọc (`now`, −1 nếu đang ở khoảng lặng).
 */
export function karaokeAt(spans: Span[], fraction: number): { done: number; now: number } {
  if (fraction >= 1) return { done: spans.length, now: -1 }
  let done = 0
  let now = -1
  for (let i = 0; i < spans.length; i++) {
    if (fraction >= spans[i].end) done = i + 1
    else if (fraction >= spans[i].start) { now = i; break }
    else break
  }
  return { done, now }
}

/** Vị trí ký tự bắt đầu của từng token trong câu (để đổi sự kiện boundary → chỉ số từ). */
export function tokenOffsets(text: string, tokens: string[]): number[] {
  const out: number[] = []
  let from = 0
  for (const t of tokens) {
    const i = text.indexOf(t, from)
    out.push(i < 0 ? from : i)
    from = (i < 0 ? from : i) + t.length
  }
  return out
}

/** Từ đang đọc tại ký tự `charIndex` (sự kiện boundary của speechSynthesis). */
export function wordAtChar(offsets: number[], charIndex: number): number {
  let k = -1
  for (let i = 0; i < offsets.length; i++) if (offsets[i] <= charIndex) k = i
  return Math.max(0, k)
}

/** Một câu để luyện karaoke. `phrase` = true nếu là cụm toolkit thật (được lưu Leitner). */
export type KaraokeLine = { item: Item; text: string; kokoro?: string; phrase: boolean; source: string }

const wordCount = (s: string) => displayTokens(s).length
/** Câu có chữ tiếng Việt (tên riêng) — máy nhận diện tiếng Anh khó khớp, nên xếp sau */
const hasNonEnglish = (s: string) => /[^\x20-\x7E—–’‘“”…]/.test(s)

/**
 * Chọn `n` câu: cụm toolkit (theo thứ tự ưu tiên của `items`) + câu hội thoại mẫu.
 * Ưu tiên câu 3–15 từ, không có chữ tiếng Việt; thiếu thì lấy câu ngắn hơn.
 */
export function karaokeLines(lesson: Lesson, items: Item[], n = 8, rnd: Rnd = Math.random): KaraokeLine[] {
  const phrases: KaraokeLine[] = items.map((it) => ({
    item: it, text: cleanPhrase(it.en), phrase: true, source: 'Cụm từ trong bài',
  }))
  const dialogue: KaraokeLine[] = []
  lesson.dialogues.forEach((d, di) =>
    d.lines.forEach((ln, li) => {
      dialogue.push({
        item: { id: `dlg${di}-${li}`, en: ln.text, vi: `Hội thoại mẫu · ${d.title}` },
        text: cleanPhrase(ln.text), kokoro: d.voices?.[ln.speaker], phrase: false, source: `Hội thoại · ${d.title}`,
      })
    }),
  )
  const good = (l: KaraokeLine) => {
    const c = wordCount(l.text)
    return c >= 3 && c <= 15 && !hasNonEnglish(l.text)
  }
  const goodP = phrases.filter(good)
  const goodD = shuffle(dialogue.filter(good), rnd)
  // Khoảng một nửa là cụm toolkit, còn lại là câu hội thoại
  const wantP = Math.min(goodP.length, Math.max(n - goodD.length, Math.ceil(n / 2)))
  const picked = [...goodP.slice(0, wantP), ...goodD.slice(0, n - wantP)]
  if (picked.length < n) {
    const rest = [...phrases, ...dialogue].filter((l) => !picked.includes(l) && wordCount(l.text) > 0)
    rest.sort((a, b) => Number(hasNonEnglish(a.text)) - Number(hasNonEnglish(b.text)) || wordCount(b.text) - wordCount(a.text))
    picked.push(...rest.slice(0, n - picked.length))
  }
  // Loại trùng câu (một cụm có thể đồng thời là một câu thoại)
  const seen = new Set<string>()
  const uniq = picked.filter((l) => {
    const k = l.text.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return shuffle(uniq, rnd).slice(0, n)
}
