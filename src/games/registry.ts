import type { GameDef } from './types'
import { QUESTION_GAMES } from './questions'
import { Match } from './Match'
import { Sequence } from './Sequence'
import { Intensity, intensityRoundsAvailable } from './Intensity'
import { Challenge } from './Challenge'
import { Review } from './Review'
import { Balloons } from './arcade/Balloons'
import { Rain } from './arcade/Rain'
import { Ninja } from './arcade/Ninja'
import { Race } from './arcade/Race'
import { STORY_GAMES } from './story'
import { BRAIN_GAMES } from './brain'
import { VOICE_GAMES } from './voice'

const byId = Object.fromEntries(QUESTION_GAMES.map((g) => [g.id, g]))

/** 14 trò theo đúng thứ tự trong thiết kế. */
export const GAMES: GameDef[] = [
  {
    id: 'balloons', name: 'Bắn bóng bay', icon: '🎈', tier: 'arcade',
    desc: 'Chạm quả bóng có câu tiếng Anh đúng nghĩa trước khi nó bay mất',
    eligible: () => true,
    lockReason: (items) => (items.length >= 3 ? null : 'Cần ít nhất 3 cụm'),
    Custom: Balloons,
  },
  {
    id: 'rain', name: 'Mưa cụm từ', icon: '☔', tier: 'arcade',
    desc: 'Cụm từ rơi xuống — chạm đúng giỏ nhóm trước khi chạm đất',
    eligible: (i) => !!i.group,
    lockReason: (items) => (items.length ? null : 'Cụm gợi ý thêm không có nhóm — chọn bộ khác'),
    Custom: Rain,
  },
  {
    id: 'ninja', name: 'Chém cụm từ', icon: '⚔️', tier: 'arcade',
    desc: 'Vuốt chém câu đúng nghĩa, né 💣 câu sai ngữ pháp',
    eligible: () => true,
    lockReason: (items) => (items.length >= 3 ? null : 'Cần ít nhất 3 cụm'),
    Custom: Ninja,
  },
  {
    id: 'race', name: 'Đua xe', icon: '🏎️', tier: 'arcade',
    desc: 'Trả lời đúng để tăng tốc — đua với xe ma kỷ lục của bạn',
    eligible: () => true,
    lockReason: (items) => (items.length >= 3 ? null : 'Cần ít nhất 3 cụm'),
    Custom: Race,
  },
  ...STORY_GAMES,
  ...BRAIN_GAMES,
  ...VOICE_GAMES,
  byId.flashcard,
  byId.quiz,
  {
    id: 'match', name: 'Nối cặp', icon: '🔗', tier: 'nho',
    desc: 'Nối câu tiếng Anh với nghĩa — nhanh nhất có thể',
    eligible: () => true,
    lockReason: (items) => (items.length >= 4 ? null : 'Cần ít nhất 4 cụm'),
    Custom: Match,
  },
  byId.listen,
  byId.sort,
  byId.situation,
  byId.synonym,
  {
    id: 'sequence', name: 'Xếp cuộc gặp', icon: '🪜', tier: 'hieu',
    desc: 'Xếp câu theo trình tự: chào → bất ngờ → hỏi thăm → kể tin → tạm biệt',
    eligible: (i) => !!i.group,
    lockReason: (items, set) =>
      set !== 'all' ? 'Chọn bộ “Tất cả” để chơi (cần đủ 5 nhóm)' : new Set(items.map((i) => i.group)).size >= 3 ? null : 'Cần ít nhất 3 nhóm',
    Custom: Sequence,
  },
  {
    id: 'intensity', name: 'Thang bất ngờ', icon: '🌡️', tier: 'hieu',
    desc: 'Xếp các câu bất ngờ từ mạnh đến nhẹ',
    eligible: (i) => !!i.intensity,
    lockReason: (items) => (intensityRoundsAvailable(items) ? null : 'Bộ này chưa có đủ câu có mức độ bất ngờ'),
    Custom: Intensity,
  },
  byId.scramble,
  byId.fill,
  byId.speak,
  {
    id: 'challenge', name: 'Thử thách nhanh', icon: '⚡', tier: 'tong-hop',
    desc: 'Trộn nhiều dạng · 3 mạng · 15 giây/câu · combo ×2',
    eligible: () => true,
    lockReason: (items) => (items.length >= 4 ? null : 'Cần ít nhất 4 cụm'),
    Custom: Challenge,
  },
  {
    id: 'review', name: 'Ôn câu hay sai', icon: '🩹', tier: 'tong-hop',
    desc: 'Gom những câu bạn hay sai nhất để ôn lại',
    eligible: () => true,
    lockReason: (items) => (items.length ? null : 'Bộ này chưa có cụm nào'),
    Custom: Review,
  },
]

export const getGame = (id: string) => GAMES.find((g) => g.id === id)
