/** Một hoạt động học vừa hoàn thành (một lượt chơi, một hội thoại, một bài ngữ pháp). */
export type Activity = {
  kind: 'game' | 'dialogue' | 'grammar'
  /** id trò (với game), hoặc khoá của hội thoại / bài ngữ pháp */
  id: string
  /** Nhóm trò (arcade, nho, hieu…) */
  tier?: string
  correct: number
  total: number
  lessonId?: string
}
