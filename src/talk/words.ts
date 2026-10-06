import type { Progress, VocabWord } from '../lib/progress'

/** Khoá chuẩn hoá cho một từ/cụm: chữ thường, bỏ dấu câu cuối, gộp khoảng trắng. */
export const wordKey = (en: string) => en.toLowerCase().replace(/[’]/g, "'").trim().replace(/[.!?,;:"“”]+$/g, '').replace(/\s+/g, ' ').trim()
/** Khoá tiến độ Leitner của từ trong Sổ từ. */
export const vocabStatKey = (key: string) => `vocab:${key}`

/** Thêm từ mới vào Sổ từ (bỏ trùng, bỏ mục quá dài). Trả lại chính `p` nếu không có gì mới. */
export function addWords(p: Progress, items: { en: string; vi: string }[], now: number): Progress {
  const add: Record<string, VocabWord> = {}
  for (const it of items) {
    const key = wordKey(it.en)
    if (!key || key.length > 80 || p.words[key] || add[key]) continue
    add[key] = { en: it.en.trim().replace(/\s+/g, ' '), vi: it.vi.trim().slice(0, 120), added: now }
  }
  return Object.keys(add).length ? { ...p, words: { ...p.words, ...add } } : p
}

export function removeWord(p: Progress, key: string): Progress {
  if (!p.words[key]) return p
  const words = { ...p.words }
  delete words[key]
  const phrases = { ...p.phrases }
  delete phrases[vocabStatKey(key)]
  return { ...p, words, phrases }
}
