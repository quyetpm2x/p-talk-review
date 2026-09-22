/** Gộp mọi phần thưởng của một hoạt động: XP, nhiệm vụ, huy hiệu, streak. Hàm thuần. */
import type { Lesson } from '../types'
import { bumpStreak, dayKey, type Progress } from '../lib/progress'
import type { Activity } from './types'
import { calcXp, levelInfo, QUEST_REWARD, type XpBreakdown } from './xp'
import { ensureDay, questsFor, questValue, type Quest } from './quests'
import { newBadges } from './badges'

export type RewardReport = {
  xpBefore: number
  xpAfter: number
  gained: number
  parts: XpBreakdown[]
  capped: boolean
  levelBefore: number
  levelAfter: number
  quests: Quest[]
  badges: string[]
}

const addUnique = (a: string[] | undefined, x: string) => (a?.includes(x) ? a : [...(a ?? []), x])

export function applyActivity(p0: Progress, act: Activity, now: number, lessons: Lesson[]): { progress: Progress; report: RewardReport } {
  const day = dayKey(now)
  let p = bumpStreak(p0, now)
  const d0 = ensureDay(p.daily, day)
  const gain = calcXp(act.correct, act.total, d0.xp)
  const perfect = act.total >= 3 && act.correct >= act.total
  const isGame = act.kind === 'game'

  // Bộ đếm trong ngày
  const daily = {
    ...d0,
    plays: d0.plays + (isGame ? 1 : 0),
    correct: d0.correct + Math.max(0, act.correct),
    arcade: d0.arcade + (act.tier === 'arcade' ? 1 : 0),
    dialogue: d0.dialogue + (act.kind === 'dialogue' ? 1 : 0),
    grammar: d0.grammar + (act.kind === 'grammar' ? 1 : 0),
    perfect: d0.perfect + (perfect ? 1 : 0),
    xp: d0.xp + gain.total,
    games: isGame ? addUnique(d0.games, act.id) : d0.games,
  }
  // Nhiệm vụ vừa hoàn thành
  const today = questsFor(day)
  const doneNow = today.filter((q) => !daily.done.includes(q.id) && questValue(q, daily) >= q.target)
  daily.done = [...daily.done, ...doneNow.map((q) => q.id)]
  const allDone = today.every((q) => daily.done.includes(q.id))
  const newlyAllDone = allDone && doneNow.length > 0

  const s = p.stats
  const tier = act.tier ?? 'other'
  const stats = {
    ...s,
    plays: s.plays + (isGame ? 1 : 0),
    correct: s.correct + Math.max(0, act.correct),
    perfect: s.perfect + (perfect ? 1 : 0),
    dialogues: s.dialogues + (act.kind === 'dialogue' ? 1 : 0),
    playedByTier: isGame ? { ...s.playedByTier, [tier]: addUnique(s.playedByTier[tier], act.id) } : s.playedByTier,
    questDays: s.questDays + (newlyAllDone ? 1 : 0),
  }
  const questXp = doneNow.length * QUEST_REWARD
  const parts = [...gain.parts, ...doneNow.map((q) => ({ label: `Nhiệm vụ: ${q.title}`, xp: QUEST_REWARD }))]
  const xpAfter = p.xp + gain.total + questXp
  p = { ...p, xp: xpAfter, daily, stats }

  const unlocked = newBadges({ p, act, now, lessons })
  if (unlocked.length) p = { ...p, badges: { ...p.badges, ...Object.fromEntries(unlocked.map((id) => [id, now])) } }

  return {
    progress: p,
    report: {
      xpBefore: p0.xp,
      xpAfter,
      gained: gain.total + questXp,
      parts,
      capped: gain.capped,
      levelBefore: levelInfo(p0.xp).level,
      levelAfter: levelInfo(xpAfter).level,
      quests: doneNow,
      badges: unlocked,
    },
  }
}
