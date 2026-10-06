/**
 * Gộp tiến độ của cùng một học sinh từ 2 nơi (máy này và máy chủ / máy khác).
 * Nguyên tắc: không làm mất thành quả nào — lấy phần "tiến xa hơn" của từng mục.
 * Hàm thuần, giao hoán và lặp lại nhiều lần vẫn ra cùng kết quả.
 */
import type { PhraseStat } from './leitner'
import { normalizeProgress, type DailyState, type Progress, type Stats } from './progress'

const union = (a: string[] = [], b: string[] = []) => [...new Set([...a, ...b])].sort()

function maxRecord(a: Record<string, number>, b: Record<string, number>) {
  const out: Record<string, number> = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? -Infinity, v)
  return out
}

/** So 2 bản: ôn gần hơn → gặp nhiều hơn → box cao hơn → sai nhiều hơn (để kết quả không phụ thuộc thứ tự gộp). */
const newer = (x: PhraseStat, y: PhraseStat) => x.last - y.last || x.seen - y.seen || x.box - y.box || x.wrong - y.wrong

/** Leitner: mỗi cụm lấy bản ôn gần nhất. */
function mergePhrases(a: Record<string, PhraseStat>, b: Record<string, PhraseStat>) {
  const out: Record<string, PhraseStat> = { ...a }
  for (const [k, s] of Object.entries(b)) {
    const cur = out[k]
    if (!cur || newer(s, cur) > 0) out[k] = s
  }
  return out
}

/** Nhiệm vụ role-play: ô nào đã xong ở một trong hai nơi thì tính là xong. */
function mergeMissions(a: Record<string, boolean[]>, b: Record<string, boolean[]>) {
  const out: Record<string, boolean[]> = { ...a }
  for (const [k, v] of Object.entries(b)) {
    const cur = out[k] ?? []
    out[k] = Array.from({ length: Math.max(cur.length, v.length) }, (_, i) => !!cur[i] || !!v[i])
  }
  return out
}

/** Huy hiệu: hợp lại, giữ thời điểm mở khoá sớm nhất. */
function mergeBadges(a: Record<string, number>, b: Record<string, number>) {
  const out: Record<string, number> = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = Math.min(out[k] ?? Infinity, v)
  return out
}

function mergeStreak(a: Progress['streak'], b: Progress['streak']): Progress['streak'] {
  if (a.lastDay !== b.lastDay) return a.lastDay > b.lastDay ? a : b
  return { lastDay: a.lastDay, count: Math.max(a.count, b.count) }
}

function mergeDaily(a: DailyState, b: DailyState): DailyState {
  if (a.day !== b.day) return a.day > b.day ? a : b
  return {
    day: a.day,
    plays: Math.max(a.plays, b.plays),
    correct: Math.max(a.correct, b.correct),
    arcade: Math.max(a.arcade, b.arcade),
    dialogue: Math.max(a.dialogue, b.dialogue),
    grammar: Math.max(a.grammar, b.grammar),
    perfect: Math.max(a.perfect, b.perfect),
    xp: Math.max(a.xp, b.xp),
    games: union(a.games, b.games),
    done: union(a.done, b.done),
  }
}

function mergeStats(a: Stats, b: Stats): Stats {
  const tiers: Record<string, string[]> = {}
  for (const k of new Set([...Object.keys(a.playedByTier), ...Object.keys(b.playedByTier)])) {
    tiers[k] = union(a.playedByTier[k], b.playedByTier[k])
  }
  return {
    plays: Math.max(a.plays, b.plays),
    correct: Math.max(a.correct, b.correct),
    perfect: Math.max(a.perfect, b.perfect),
    dialogues: Math.max(a.dialogues, b.dialogues),
    questDays: Math.max(a.questDays, b.questDays),
    playedByTier: tiers,
  }
}

/** Sổ từ: hợp lại, giữ thời điểm thêm sớm nhất. */
function mergeWords(a: Progress['words'], b: Progress['words']) {
  const out: Progress['words'] = { ...a }
  for (const [k, w] of Object.entries(b)) if (!out[k] || w.added < out[k].added) out[k] = w
  return out
}

/** Gộp hai bản tiến độ. `name` lấy theo tham số (tên trong tài khoản), không có thì theo bản `a`. */
export function mergeProgress(rawA: unknown, rawB: unknown, name?: string): Progress {
  const a = normalizeProgress(rawA)
  const b = normalizeProgress(rawB)
  return {
    ...a,
    ...b,
    name: name ?? (a.name || b.name),
    phrases: mergePhrases(a.phrases, b.phrases),
    bestScores: maxRecord(a.bestScores, b.bestScores),
    missions: mergeMissions(a.missions, b.missions),
    streak: mergeStreak(a.streak, b.streak),
    xp: Math.max(a.xp, b.xp),
    badges: mergeBadges(a.badges, b.badges),
    daily: mergeDaily(a.daily, b.daily),
    stats: mergeStats(a.stats, b.stats),
    words: mergeWords(a.words, b.words),
  }
}

/** Tiến độ có gì đáng giữ không (để biết máy này có dữ liệu cũ cần gộp vào tài khoản). */
export const hasProgress = (raw: unknown) => {
  const p = normalizeProgress(raw)
  return p.xp > 0 || Object.keys(p.phrases).length > 0 || Object.keys(p.badges).length > 0 || p.stats.plays > 0
}
