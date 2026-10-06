import * as storage from '../lib/storage'

/** Thiết lập luyện nói của học sinh (lưu trên máy, app native sao lưu bền). */
export type TalkSettings = {
  /** Tốc độ gia sư: 0.7 / 0.9 / 1 / 1.2 */
  speed: number
  /** Chủ đề quan tâm (id trong TOPICS) — dùng cho Trò chuyện tự do */
  topics: string[]
  /** Đã xem màn thiết lập lần đầu chưa */
  onboarded: boolean
  /** Bật chấm phát âm (cần tải mô hình 355MB một lần) */
  pron: boolean
}

const KEY = 'ptalk:talk-settings'
export const SPEEDS = [
  { v: 0.7, label: 'Rất chậm', sub: 'Rõ ràng, theo từng âm tiết' },
  { v: 0.9, label: 'Chậm', sub: 'Hơi chậm hơn bình thường' },
  { v: 1, label: 'Bình thường', sub: 'Tốc độ tự nhiên' },
  { v: 1.2, label: 'Nhanh', sub: 'Như người bản xứ' },
]
export const TOPICS = [
  { id: 'family', icon: '👨‍👩‍👧', vi: 'Gia đình', en: 'family' },
  { id: 'school', icon: '🏫', vi: 'Trường học', en: 'school and classmates' },
  { id: 'pets', icon: '🐶', vi: 'Thú cưng', en: 'pets and animals' },
  { id: 'food', icon: '🍜', vi: 'Đồ ăn', en: 'food and cooking' },
  { id: 'hobbies', icon: '🎨', vi: 'Sở thích', en: 'hobbies and free time' },
  { id: 'sports', icon: '⚽', vi: 'Thể thao', en: 'sports' },
  { id: 'travel', icon: '✈️', vi: 'Du lịch', en: 'travel and places' },
  { id: 'tech', icon: '📱', vi: 'Công nghệ', en: 'technology and games' },
  { id: 'dreams', icon: '💭', vi: 'Ước mơ', en: 'dreams and future plans' },
  { id: 'movies', icon: '🎬', vi: 'Phim & nhạc', en: 'movies and music' },
]

export function loadTalkSettings(): TalkSettings {
  try {
    const s = JSON.parse(storage.getItem(KEY) ?? 'null')
    if (s && typeof s.speed === 'number') return { speed: s.speed, topics: Array.isArray(s.topics) ? s.topics : [], onboarded: !!s.onboarded, pron: !!s.pron }
  } catch { /* hỏng → mặc định */ }
  return { speed: 0.9, topics: [], onboarded: false, pron: false }
}
export const saveTalkSettings = (s: TalkSettings) => storage.setItem(KEY, JSON.stringify(s))
