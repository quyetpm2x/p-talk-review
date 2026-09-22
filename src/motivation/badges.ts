/** Huy hiệu — điều kiện là hàm thuần trên Progress (đã cập nhật) + hoạt động vừa xong. */
import type { Lesson } from '../types'
import { currentStreak, lessonPercent, statKey, type Progress } from '../lib/progress'
import type { Activity } from './types'

export type BadgeCtx = { p: Progress; act: Activity; now: number; lessons: Lesson[] }
export type Badge = { id: string; icon: string; name: string; desc: string; test: (c: BadgeCtx) => boolean }

/** Số id trò khác nhau đã từng chơi. */
export const distinctGames = (p: Progress) => new Set(Object.values(p.stats.playedByTier).flat()).size

/** Đã nhớ chắc (box ≥ 3) mọi cụm nhóm `group` — cần ít nhất một bài có nhóm này. */
export function masteredGroup(p: Progress, lessons: Lesson[], group: string): boolean {
  const list = lessons.flatMap((l) => l.phrases.filter((ph) => ph.group === group).map((ph) => statKey(l.id, ph.id)))
  return list.length > 0 && list.every((k) => (p.phrases[k]?.box ?? 0) >= 3)
}

export const ARCADE_COUNT = 4

export const BADGES: Badge[] = [
  { id: 'first', icon: '🐣', name: 'Bước đầu tiên', desc: 'Hoàn thành lượt học đầu tiên',
    test: () => true },
  { id: 'surprise', icon: '😲', name: 'Bậc thầy bất ngờ', desc: 'Nhớ chắc mọi cụm nhóm Bày tỏ bất ngờ',
    test: ({ p, lessons }) => masteredGroup(p, lessons, 'surprise') },
  { id: 'streak7', icon: '🔥', name: '7 ngày liên tiếp', desc: 'Học 7 ngày liền không nghỉ',
    test: ({ p, now }) => currentStreak(p, now) >= 7 },
  { id: 'flawless', icon: '💯', name: 'Không sai câu nào', desc: 'Đúng 100% một lượt có từ 8 câu',
    test: ({ act }) => act.total >= 8 && act.correct >= act.total },
  { id: 'explorer', icon: '🧭', name: 'Thử đủ 5 trò', desc: 'Chơi 5 trò chơi khác nhau',
    test: ({ p }) => distinctGames(p) >= 5 },
  { id: 'arcade', icon: '🎮', name: 'Nhà vô địch Giải trí', desc: `Chơi đủ ${ARCADE_COUNT} trò nhóm Giải trí`,
    test: ({ p }) => (p.stats.playedByTier.arcade?.length ?? 0) >= ARCADE_COUNT },
  { id: 'owl', icon: '🦉', name: 'Cú đêm', desc: 'Học sau 22 giờ',
    test: ({ now }) => { const h = new Date(now).getHours(); return h >= 22 || h < 4 } },
  { id: 'early', icon: '🌅', name: 'Chim sớm', desc: 'Học trước 7 giờ sáng',
    test: ({ now }) => { const h = new Date(now).getHours(); return h >= 4 && h < 7 } },
  { id: 'xp1000', icon: '💪', name: 'Chăm chỉ', desc: 'Tích luỹ 1000 XP',
    test: ({ p }) => p.xp >= 1000 },
  { id: 'actor', icon: '🎭', name: 'Diễn viên', desc: 'Hoàn thành một hội thoại',
    test: ({ p }) => p.stats.dialogues >= 1 },
  { id: 'fullday', icon: '📅', name: 'Ngày trọn vẹn', desc: 'Xong cả 3 nhiệm vụ trong một ngày',
    test: ({ p }) => p.stats.questDays >= 1 },
  { id: 'graduate', icon: '🎓', name: 'Tốt nghiệp', desc: 'Đạt 80% tiến độ một bài học',
    test: ({ p, lessons }) => lessons.some((l) => lessonPercent(p, l) >= 80) },
  { id: 'plays50', icon: '🏅', name: 'Bền bỉ', desc: 'Hoàn thành 50 lượt chơi',
    test: ({ p }) => p.stats.plays >= 50 },
]

export const getBadge = (id: string) => BADGES.find((b) => b.id === id)

/** Các huy hiệu mới đạt (chưa có trong p.badges). */
export function newBadges(c: BadgeCtx): string[] {
  return BADGES.filter((b) => !(b.id in c.p.badges) && b.test(c)).map((b) => b.id)
}
