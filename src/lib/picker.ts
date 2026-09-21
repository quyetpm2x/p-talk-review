import type { Lesson } from '../types'
import { isDue, type PhraseStat } from './leitner'
import { shuffle, type Rnd } from './shuffle'

/** Một cụm để hỏi — gộp cụm chính và cụm gợi ý thêm. */
export type Item = {
  id: string
  en: string
  vi: string
  group?: string
  synonym?: string
  intensity?: number
  situation?: string
  blank?: string
  note?: string
  extra?: boolean
}

/** set: 'all' | 'extra' | id của một nhóm */
export function phrasePool(lesson: Lesson, set: string): Item[] {
  if (set === 'extra') return lesson.extraPhrases.map((p) => ({ ...p, extra: true }))
  const all: Item[] = lesson.phrases.map((p) => ({ ...p }))
  return set === 'all' ? all : all.filter((p) => p.group === set)
}

/** Chọn n cụm: đến hạn trước, rồi box thấp, rồi ngẫu nhiên. */
export function pickItems(
  pool: Item[], stats: Record<string, PhraseStat>, lessonId: string, n: number, now: number, rnd: Rnd = Math.random,
): Item[] {
  const rank = (i: Item) => {
    const s = stats[`${lessonId}:${i.id}`]
    return (isDue(s, now) ? 0 : 10) + (s?.box ?? 0)
  }
  return shuffle(pool, rnd)
    .map((i) => ({ i, r: rank(i) }))
    .sort((a, b) => a.r - b.r)
    .slice(0, n)
    .map((x) => x.i)
}

/** Đáp án nhiễu: khác target, không trùng giá trị key, ưu tiên cùng nhóm. */
export function distractors(
  target: Item, pool: Item[], n: number, key: (i: Item) => string | undefined, rnd: Rnd = Math.random,
): Item[] {
  const tk = key(target)
  const seen = new Set<string>(tk ? [tk] : [])
  const cands = pool.filter((i) => i.id !== target.id && key(i))
  const same = shuffle(cands.filter((i) => target.group && i.group === target.group), rnd)
  const other = shuffle(cands.filter((i) => !(target.group && i.group === target.group)), rnd)
  const out: Item[] = []
  for (const i of [...same, ...other]) {
    const k = key(i)!
    if (seen.has(k)) continue
    seen.add(k)
    out.push(i)
    if (out.length === n) break
  }
  return out
}

/** Các cụm hay sai nhất (đã từng sai), sai nhiều trước, box thấp trước. */
export function hardest(pool: Item[], stats: Record<string, PhraseStat>, lessonId: string, n: number): Item[] {
  return pool
    .map((i) => ({ i, s: stats[`${lessonId}:${i.id}`] }))
    .filter((x) => x.s && x.s.seen > 0 && (x.s.wrong > 0 || x.s.box <= 1))
    .sort((a, b) => b.s!.wrong - a.s!.wrong || a.s!.box - b.s!.box)
    .slice(0, n)
    .map((x) => x.i)
}
