import type { GameDef } from '../types'
import { Story } from './Story'
import { Chat } from './Chat'
import { chatLockReason, storyLockReason } from './data'

/** Phần B: Phim tương tác, Nhắn tin Zalo */
export const STORY_GAMES: GameDef[] = [
  {
    id: 'story', name: 'Tương tác', icon: '🎬', tier: 'story',
    desc: 'Mở phim: tình cờ gặp lại bạn cũ ở quán cà phê, trên phố hay ở tiệc cưới — chọn câu đáp khéo để mở cái kết đẹp nhất',
    eligible: () => true,
    lockReason: (_items, _set, lesson) => storyLockReason(lesson),
    Custom: Story,
    fullscreen: true,
  },
  {
    id: 'chat', name: 'Nhắn tin Zalo', icon: '💬', tier: 'story',
    desc: 'Bạn cũ nhắn tin — trả lời kịp giờ bằng gợi ý hoặc bằng giọng nói',
    eligible: () => true,
    lockReason: (_items, _set, lesson) => chatLockReason(lesson),
    Custom: Chat,
    fullscreen: true,
  },
]
