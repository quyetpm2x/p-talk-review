const CONTRACTIONS: [RegExp, string][] = [
  [/\bcan't\b/g, 'can not'],
  [/\bwon't\b/g, 'will not'],
  [/n't\b/g, ' not'],
  [/'re\b/g, ' are'],
  [/'ve\b/g, ' have'],
  [/'ll\b/g, ' will'],
  [/'m\b/g, ' am'],
  [/'d\b/g, ' would'],
  [/\blet's\b/g, 'let us'],
  [/'s\b/g, ' is'],
]

/** Chuẩn hoá câu thành mảng từ: chữ thường, mở rộng viết tắt, bỏ dấu câu. */
export function normalize(s: string): string[] {
  let t = s.toLowerCase().replace(/[’‘`]/g, "'")
  for (const [re, rep] of CONTRACTIONS) t = t.replace(re, rep)
  return t
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/** Chỉ số các từ của a nằm trong dãy con chung dài nhất với b. */
function lcsIndices(a: string[], b: string[]): Set<number> {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const out = new Set<number>()
  let i = 0, j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out.add(i); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  return out
}

/** Tỉ lệ từ của câu mẫu xuất hiện (đúng thứ tự) trong câu đã nói, 0–1. */
export function matchRatio(target: string, said: string): number {
  const t = normalize(target)
  if (!t.length) return 0
  return lcsIndices(t, normalize(said)).size / t.length
}

/** Các từ hiển thị của câu mẫu (bỏ ký hiệu đứng riêng như — hoặc ...). */
export const displayTokens = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w))

/** Với mỗi từ hiển thị của câu mẫu: đã được nói ra hay chưa. */
export function matchedWords(target: string, said: string): boolean[] {
  const tokens = displayTokens(target)
  const parts = tokens.map(normalize)
  const flat = parts.flat()
  const hit = lcsIndices(flat, normalize(said))
  let k = 0
  return parts.map((p) => {
    const ok = p.every((_, x) => hit.has(k + x))
    k += p.length
    return ok
  })
}

function lev(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]
    d[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j]
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return d[b.length]
}

const simple = (s: string) =>
  s.toLowerCase().replace(/[’‘`]/g, "'").replace(/[.,!?;:"“”]/g, '').replace(/\s+/g, ' ').trim()

/** So đáp án gõ tay: exact / near (lệch 1 ký tự) / wrong. */
export function fuzzyEqual(expected: string, typed: string): 'exact' | 'near' | 'wrong' {
  const a = simple(expected), b = simple(typed)
  if (!b) return 'wrong'
  if (a === b) return 'exact'
  if (a.length >= 4 && lev(a, b) <= 1) return 'near'
  return 'wrong'
}

/** Từ bị ẩn trong trò Điền từ: trường blank hoặc từ dài nhất. */
export function blankOf(p: { en: string; blank?: string }): string {
  if (p.blank) return p.blank
  const words = p.en.split(/\s+/).map((w) => w.replace(/[^\p{L}'’]/gu, ''))
  return words.reduce((best, w) => (w.length > best.length ? w : best), '')
}

/** Bỏ phần "..." ở cuối các cụm mở đầu (Believe it or not, ...) để đọc/ghép từ. */
export const cleanPhrase = (s: string) => s.replace(/[\s,—–-]*(\.\.\.|…)\s*$/u, '').trim()
