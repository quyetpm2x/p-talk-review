import type { FC } from 'react'
import type { Lesson } from '../types'
import type { Item } from '../lib/picker'

export type AnswerResult = { correct: boolean; points: number }

export type QuestionProps = {
  item: Item
  /** Các cụm dùng làm đáp án nhiễu */
  pool: Item[]
  lesson: Lesson
  onAnswer: (r: AnswerResult) => void
}

export type FinishResult = {
  score: number
  correct: number
  total: number
  wrong: Item[]
  /** Chi tiết từng câu theo thứ tự đã làm (nếu trò có) */
  answers?: { item: Item; correct: boolean }[]
  /** Thời gian làm bài, giây */
  seconds?: number
}

export type CustomGameProps = {
  lesson: Lesson
  /** Các cụm của bộ đang chọn, đã lọc theo điều kiện của trò */
  items: Item[]
  /** Toàn bộ cụm cùng loại (để lấy đáp án nhiễu) */
  pool: Item[]
  record: (itemId: string, correct: boolean) => void
  finish: (r: FinishResult) => void
}

export type Tier = 'nho' | 'hieu' | 'dung' | 'tong-hop'

export type GameDef = {
  id: string
  name: string
  icon: string
  tier: Tier
  desc: string
  eligible: (i: Item) => boolean
  /** Trả về lý do khoá nếu bộ cụm không đủ dữ liệu, null nếu chơi được */
  lockReason: (items: Item[], set: string) => string | null
  /** Tự chuyển câu ngay sau khi trả lời (thẻ lật) */
  autoNext?: boolean
  perRound?: number
  Question?: FC<QuestionProps>
  Custom?: FC<CustomGameProps>
}

export const TIERS: { id: Tier; name: string; desc: string }[] = [
  { id: 'nho', name: 'Nhớ', desc: 'Nhận ra cụm và nghĩa' },
  { id: 'hieu', name: 'Hiểu', desc: 'Dùng đúng chỗ, đúng sắc thái' },
  { id: 'dung', name: 'Dùng', desc: 'Tự viết, tự nói ra' },
  { id: 'tong-hop', name: 'Tổng hợp', desc: 'Trộn tất cả & ôn câu hay sai' },
]
