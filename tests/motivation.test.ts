import { describe, it, expect } from 'vitest'
import { emptyProgress, dayKey, statKey, type Progress } from '../src/lib/progress'
import { calcXp, levelInfo, xpToReach, MAX_PER_RUN, DAILY_SOFT_CAP, QUEST_REWARD } from '../src/motivation/xp'
import { questsFor, ensureDay, questValue, QUESTS, QUESTS_PER_DAY } from '../src/motivation/quests'
import { BADGES, newBadges, masteredGroup, type BadgeCtx } from '../src/motivation/badges'
import { applyActivity } from '../src/motivation/engine'
import type { Activity } from '../src/motivation/types'
import lessonJson from '../src/lessons/level2-01.json'
import type { Lesson } from '../src/types'

const lesson = lessonJson as Lesson
const lessons = [lesson]
const DAY = 86400000
const t0 = new Date(2026, 8, 22, 10).getTime()
const game = (id: string, correct: number, total: number, tier = 'nho'): Activity => ({ kind: 'game', id, tier, correct, total, lessonId: lesson.id })
const ctx = (p: Progress, act: Activity = game('quiz', 5, 10), now = t0): BadgeCtx => ({ p, act, now, lessons })
const has = (id: string, c: BadgeCtx) => BADGES.find((b) => b.id === id)!.test(c)

describe('XP', () => {
  it('10 XP/câu đúng + 20 hoàn thành + 30 khi 100%', () => {
    expect(calcXp(7, 10).total).toBe(70 + 20)
    expect(calcXp(10, 10).total).toBe(100 + 20 + 30)
    expect(calcXp(0, 10).total).toBe(20)
    // lượt quá ngắn không được thưởng 100%
    expect(calcXp(3, 3).total).toBe(30 + 20)
  })
  it('có trần mỗi lượt và giảm mạnh khi vượt trần ngày', () => {
    expect(calcXp(100, 100).total).toBeLessThanOrEqual(MAX_PER_RUN)
    const over = calcXp(10, 10, DAILY_SOFT_CAP)
    expect(over.total).toBe(Math.round(150 * 0.2))
    expect(over.capped).toBe(true)
    const half = calcXp(10, 10, DAILY_SOFT_CAP - 50)
    expect(half.total).toBe(50 + Math.round(100 * 0.2))
  })
  it('cấp độ theo ngưỡng tăng dần', () => {
    expect(levelInfo(0)).toMatchObject({ level: 1, into: 0, need: 100 })
    expect(levelInfo(99).level).toBe(1)
    expect(levelInfo(100).level).toBe(2)
    expect(levelInfo(249).level).toBe(2)
    expect(levelInfo(250)).toMatchObject({ level: 3, into: 0, need: 200 })
    for (let l = 1; l < 20; l++) {
      expect(xpToReach(l + 1) - xpToReach(l)).toBeGreaterThan(xpToReach(l) - xpToReach(Math.max(1, l - 1)) - 1)
      expect(levelInfo(xpToReach(l)).level).toBe(l)
      expect(levelInfo(xpToReach(l + 1) - 1).level).toBe(l)
    }
    expect(levelInfo(-5).level).toBe(1)
  })
})

describe('Nhiệm vụ hằng ngày', () => {
  it('3 nhiệm vụ, cố định theo ngày, không trùng loại', () => {
    const a = questsFor('2026-09-22')
    expect(a).toHaveLength(QUESTS_PER_DAY)
    expect(questsFor('2026-09-22')).toEqual(a)
    expect(new Set(a.map((q) => q.metric)).size).toBe(QUESTS_PER_DAY)
    // qua nhiều ngày thì dùng đến nhiều nhiệm vụ khác nhau
    const seen = new Set<string>()
    for (let i = 0; i < 60; i++) questsFor(dayKey(t0 + i * DAY)).forEach((q) => seen.add(q.id))
    expect(seen.size).toBeGreaterThan(QUESTS.length / 2)
  })
  it('reset khi sang ngày mới', () => {
    const d = { ...ensureDay(undefined, '2026-09-22'), plays: 3, done: ['play2'] }
    expect(ensureDay(d, '2026-09-22')).toBe(d)
    const n = ensureDay(d, '2026-09-23')
    expect(n.day).toBe('2026-09-23')
    expect(n.plays).toBe(0)
    expect(n.done).toEqual([])
  })
  it('hoàn thành nhiệm vụ → cộng thưởng XP một lần', () => {
    const day = dayKey(t0)
    let p = emptyProgress()
    let bonusSeen = 0
    const qs = questsFor(day)
    // chơi thật nhiều để xong mọi nhiệm vụ
    const acts: Activity[] = [
      game('quiz', 10, 10), game('balloons', 10, 10, 'arcade'), game('listen', 10, 10), game('fill', 10, 10), game('sort', 10, 10),
      { kind: 'dialogue', id: 'd', correct: 5, total: 5 }, { kind: 'grammar', id: 'g', correct: 5, total: 5 },
    ]
    for (const a of acts) {
      const r = applyActivity(p, a, t0, lessons)
      bonusSeen += r.report.quests.length
      p = r.progress
    }
    expect(bonusSeen).toBe(qs.length)
    expect(p.daily.done.sort()).toEqual(qs.map((q) => q.id).sort())
    expect(p.stats.questDays).toBe(1)
    qs.forEach((q) => expect(questValue(q, p.daily)).toBeGreaterThanOrEqual(q.target))
    // chơi tiếp không nhận thưởng nhiệm vụ lần 2
    const again = applyActivity(p, game('quiz', 1, 10), t0 + 1000, lessons)
    expect(again.report.quests).toEqual([])
    // hôm sau: bộ đếm về 0
    const tomorrow = applyActivity(p, game('quiz', 1, 10), t0 + DAY, lessons)
    expect(tomorrow.progress.daily.day).toBe(dayKey(t0 + DAY))
    expect(tomorrow.progress.daily.plays).toBe(1)
  })
})

describe('Huy hiệu', () => {
  it('Bậc thầy bất ngờ: mọi cụm nhóm surprise có box ≥ 3', () => {
    const ids = lesson.phrases.filter((x) => x.group === 'surprise').map((x) => x.id)
    const phrases: Progress['phrases'] = {}
    ids.forEach((id) => (phrases[statKey(lesson.id, id)] = { box: 3, wrong: 0, seen: 3, last: 0 }))
    const p = { ...emptyProgress(), phrases }
    expect(masteredGroup(p, lessons, 'surprise')).toBe(true)
    expect(has('surprise', ctx(p))).toBe(true)
    phrases[statKey(lesson.id, ids[0])] = { box: 2, wrong: 1, seen: 3, last: 0 }
    expect(has('surprise', ctx({ ...p, phrases }))).toBe(false)
    expect(masteredGroup(p, lessons, 'khong-co')).toBe(false)
  })
  it('Không sai câu nào: 100% với ≥ 8 câu', () => {
    const p = emptyProgress()
    expect(has('flawless', ctx(p, game('quiz', 8, 8)))).toBe(true)
    expect(has('flawless', ctx(p, game('quiz', 7, 7)))).toBe(false)
    expect(has('flawless', ctx(p, game('quiz', 9, 10)))).toBe(false)
  })
  it('7 ngày liên tiếp, Cú đêm, Chim sớm, Chăm chỉ', () => {
    const p = { ...emptyProgress(), streak: { count: 7, lastDay: dayKey(t0) } }
    expect(has('streak7', ctx(p))).toBe(true)
    expect(has('streak7', ctx({ ...p, streak: { count: 6, lastDay: dayKey(t0) } }))).toBe(false)
    expect(has('owl', ctx(p, undefined, new Date(2026, 8, 22, 22, 30).getTime()))).toBe(true)
    expect(has('owl', ctx(p, undefined, new Date(2026, 8, 22, 21, 59).getTime()))).toBe(false)
    expect(has('early', ctx(p, undefined, new Date(2026, 8, 22, 6).getTime()))).toBe(true)
    expect(has('xp1000', ctx({ ...p, xp: 999 }))).toBe(false)
    expect(has('xp1000', ctx({ ...p, xp: 1000 }))).toBe(true)
  })
  it('Thử đủ 5 trò & Nhà vô địch Giải trí', () => {
    let p = emptyProgress()
    for (const id of ['quiz', 'listen', 'fill', 'sort']) p = applyActivity(p, game(id, 1, 10), t0, lessons).progress
    expect(p.badges.explorer).toBeUndefined()
    p = applyActivity(p, game('balloons', 1, 10, 'arcade'), t0, lessons).progress
    expect(p.badges.explorer).toBe(t0)
    expect(p.badges.arcade).toBeUndefined()
    for (const id of ['rain', 'ninja', 'rain']) p = applyActivity(p, game(id, 1, 10, 'arcade'), t0, lessons).progress
    expect(p.badges.arcade).toBeUndefined()
    const r = applyActivity(p, game('race', 1, 10, 'arcade'), t0, lessons)
    expect(r.report.badges).toContain('arcade')
  })
  it('huy hiệu chỉ mở một lần, có ít nhất 8 huy hiệu, id không trùng', () => {
    expect(BADGES.length).toBeGreaterThanOrEqual(8)
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length)
    const r1 = applyActivity(emptyProgress(), game('quiz', 10, 10), t0, lessons)
    expect(r1.report.badges).toContain('first')
    const r2 = applyActivity(r1.progress, game('quiz', 10, 10), t0 + 1000, lessons)
    expect(r2.report.badges).not.toContain('first')
    expect(newBadges(ctx(r2.progress))).not.toContain('first')
  })
})

describe('applyActivity', () => {
  it('cộng XP, lên cấp, streak, thống kê — không đổi progress gốc', () => {
    const p0 = emptyProgress()
    const r = applyActivity(p0, game('quiz', 10, 10), t0, lessons)
    const base = 150
    expect(r.report.gained).toBe(base + r.report.quests.length * QUEST_REWARD)
    expect(r.progress.xp).toBe(r.report.gained)
    expect(r.report.levelBefore).toBe(1)
    expect(r.report.levelAfter).toBe(levelInfo(r.progress.xp).level)
    expect(r.progress.streak.count).toBe(1)
    expect(r.progress.stats.plays).toBe(1)
    expect(r.progress.stats.playedByTier.nho).toEqual(['quiz'])
    expect(p0.xp).toBe(0)
    expect(p0.stats.plays).toBe(0)
  })
  it('hội thoại / ngữ pháp không tính là lượt chơi trò', () => {
    const r = applyActivity(emptyProgress(), { kind: 'dialogue', id: 'L:dlg0:fill', correct: 4, total: 5 }, t0, lessons)
    expect(r.progress.stats.plays).toBe(0)
    expect(r.progress.stats.dialogues).toBe(1)
    expect(r.progress.daily.dialogue).toBe(1)
    expect(r.progress.badges.actor).toBe(t0)
  })
})
