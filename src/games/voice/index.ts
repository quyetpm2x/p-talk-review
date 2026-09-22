import type { GameDef } from '../types'
import { Karaoke } from './Karaoke'
import { Boss } from './Boss'

/** Phần D: Karaoke nhại giọng, Đánh boss */
export const VOICE_GAMES: GameDef[] = [
  {
    id: 'karaoke', name: 'Karaoke', icon: '🎶', tier: 'voice',
    desc: 'Nghe giọng mẫu, chữ sáng dần theo lời đọc — rồi nhại lại thật giống',
    eligible: () => true,
    // Luôn có câu hội thoại mẫu để bù nếu bộ cụm ít
    lockReason: (items) => (items.length ? null : 'Bộ này chưa có cụm nào'),
    Custom: Karaoke,
  },
  {
    id: 'boss', name: 'Đánh quái vật', icon: '👾', tier: 'voice',
    desc: 'Nói đúng câu tiếng Anh để chém boss — nói sai là bị phản đòn!',
    eligible: () => true,
    lockReason: (items) => (items.length >= 3 ? null : 'Cần ít nhất 3 cụm'),
    Custom: Boss,
    fullscreen: true,
  },
]
