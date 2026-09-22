/** Logic thuần cho nhóm "Trí nhớ & đố vui" — không phụ thuộc React, có test ở tests/brain.test.ts */
import { blankOf } from '../../lib/scoring'
import { shuffle, type Rnd } from '../../lib/shuffle'

/* ───────────── Lật thẻ tìm cặp ───────────── */

/** Điểm lật thẻ: số lượt tối thiểu = số cặp; mỗi lượt thừa trừ 10 điểm, tối đa 200. */
export function memoryScore(turns: number, pairs = 6): number {
  return Math.max(0, 200 - Math.max(0, turns - pairs) * 10)
}

/**
 * Khi lật sai 2 thẻ a, b: cặp nào bị tính là "nhớ sai"?
 * Chỉ trách thẻ mà bạn của nó ĐÃ từng được lật ra trước đó (lẽ ra phải nhớ được vị trí).
 * `seen` là tập key các thẻ đã từng được lật trước lượt này; partnerOf trả key thẻ cùng cặp.
 */
export function mismatchBlame(
  a: { key: string; pair: string }, b: { key: string; pair: string },
  seen: ReadonlySet<string>, partnerOf: (key: string) => string,
): string[] {
  const out: string[] = []
  for (const c of [a, b]) if (seen.has(partnerOf(c.key)) && !out.includes(c.pair)) out.push(c.pair)
  return out
}

/* ───────────── Wordle cụm từ ───────────── */

export type Mark = 'ok' | 'near' | 'miss'

/** Từ khoá dùng cho Wordle: chữ thường, chỉ a–z, dài 3–8; không hợp lệ thì null. */
export function wordleKey(p: { en: string; blank?: string }): string | null {
  const w = blankOf(p).toLowerCase().replace(/['’]/g, '')
  return /^[a-z]{3,8}$/.test(w) ? w : null
}

/**
 * Chọn `n` câu cho một lượt Wordle: ngẫu nhiên, ưu tiên câu KHÔNG có trong `recent`
 * (lượt trước), không trùng từ khoá. Thiếu câu mới thì lấy thêm câu cũ.
 */
export function wordleRound<T extends { id: string }>(
  pool: T[], n: number, recent: readonly string[], key: (x: T) => string | null, rnd: Rnd = Math.random,
): T[] {
  const old = new Set(recent)
  const fresh = shuffle(pool.filter((x) => !old.has(x.id)), rnd)
  const stale = shuffle(pool.filter((x) => old.has(x.id)), rnd)
  const seen = new Set<string>()
  const out: T[] = []
  for (const x of [...fresh, ...stale]) {
    const k = key(x)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(x)
    if (out.length === n) break
  }
  return out
}

/** Chấm màu một lượt đoán kiểu Wordle, xử lý đúng chữ lặp lại. */
export function scoreGuess(guess: string, answer: string): Mark[] {
  const g = guess.toLowerCase().split(''), a = answer.toLowerCase().split('')
  const res: Mark[] = g.map(() => 'miss')
  const left: Record<string, number> = {}
  g.forEach((ch, i) => {
    if (ch === a[i]) res[i] = 'ok'
    else if (a[i] !== undefined) left[a[i]] = (left[a[i]] ?? 0) + 1
  })
  g.forEach((ch, i) => {
    if (res[i] !== 'ok' && left[ch] > 0) { res[i] = 'near'; left[ch]-- }
  })
  return res
}

const RANK: Record<Mark, number> = { miss: 0, near: 1, ok: 2 }

/** Cập nhật màu bàn phím: giữ trạng thái tốt nhất đã biết của mỗi chữ. */
export function mergeKeys(prev: Record<string, Mark>, guess: string, marks: Mark[]): Record<string, Mark> {
  const out = { ...prev }
  guess.toLowerCase().split('').forEach((ch, i) => {
    const m = marks[i]
    if (!out[ch] || RANK[m] > RANK[out[ch]]) out[ch] = m
  })
  return out
}

/** Điểm một cụm Wordle theo số lượt đã dùng (1 → 60 … 6 → 10), không đoán ra = 0. */
export const wordlePoints = (tries: number, solved: boolean) => (solved ? Math.max(10, (7 - tries) * 10) : 0)

/** Chia câu thành [trước, từ khoá gốc, sau] để hiện ô trống; không tìm thấy thì null. */
export function splitAtKey(en: string, key: string): [string, string, string] | null {
  const re = new RegExp(`(^|[^A-Za-z'’])(${key.split('').join("['’]?")})(?![A-Za-z])`, 'i')
  const m = re.exec(en)
  if (!m) return null
  const at = m.index + m[1].length
  return [en.slice(0, at), m[2], en.slice(at + m[2].length)]
}

/* ───────────── Bingo ───────────── */

/**
 * Xáo lại vị trí các ô CHƯA đánh dấu (ô đã đánh dấu đứng yên để giữ các đường đang có).
 * Luôn đổi được ít nhất một chỗ khi còn ≥ 2 ô trống.
 */
export function reshuffleUnmarked<T>(board: readonly T[], marked: readonly boolean[], rnd: Rnd = Math.random): T[] {
  const slots = board.map((_, i) => i).filter((i) => !marked[i])
  if (slots.length < 2) return board.slice()
  const vals = slots.map((i) => board[i])
  let mixed = shuffle(vals, rnd)
  for (let k = 0; k < 10 && mixed.every((v, j) => v === vals[j]); k++) mixed = shuffle(vals, rnd)
  if (mixed.every((v, j) => v === vals[j])) mixed = [...vals.slice(1), vals[0]]
  const out = board.slice()
  slots.forEach((i, j) => { out[i] = mixed[j] })
  return out
}

/** Tất cả hàng, cột, 2 đường chéo của bảng size×size (chỉ số ô 0..size²−1). */
export function bingoLines(size = 4): number[][] {
  const r = [...Array(size).keys()]
  return [
    ...r.map((y) => r.map((x) => y * size + x)),
    ...r.map((x) => r.map((y) => y * size + x)),
    r.map((i) => i * size + i),
    r.map((i) => i * size + (size - 1 - i)),
  ]
}

/** Các đường đã hoàn thành (mỗi đường là mảng chỉ số ô). */
export function completedLines(marked: readonly boolean[], size = 4): number[][] {
  return bingoLines(size).filter((l) => l.every((i) => marked[i]))
}

export const hasBingo = (marked: readonly boolean[], size = 4) => completedLines(marked, size).length > 0

/* ───────────── Vòng quay ───────────── */

/** Ô đang nằm dưới kim (kim ở đỉnh) khi vòng đã xoay `rotation` độ theo chiều kim đồng hồ. Ô 0 bắt đầu ở đỉnh, đi theo chiều kim đồng hồ. */
export function segmentAt(rotation: number, n: number): number {
  const seg = 360 / n
  const a = (((-rotation) % 360) + 360) % 360
  return Math.floor(a / seg + 1e-9) % n
}

/**
 * Góc quay mới (luôn lớn hơn góc hiện tại) để vòng dừng với ô `index` dưới kim.
 * `turns` vòng đầy đủ + phần lẻ; `offset` lệch khỏi tâm ô (bị giới hạn trong ±40% bề rộng ô).
 */
export function spinTarget(current: number, index: number, n: number, turns = 5, offset = 0): number {
  const seg = 360 / n
  const center = (index + 0.5) * seg
  const want = (((-center) % 360) + 360) % 360
  const cur = ((current % 360) + 360) % 360
  let delta = want - cur
  if (delta < 0) delta += 360
  const off = Math.max(-seg * 0.4, Math.min(seg * 0.4, offset))
  return current + turns * 360 + delta + off
}

/** Tên nhóm rút gọn cho ô vòng quay: phần trước "&", quá dài thì lấy 2 từ đầu. */
export function shortGroupName(vi: string): string {
  const first = vi.split('&')[0].trim()
  return first.length > 10 ? first.split(/\s+/).slice(0, 2).join(' ') : first
}
