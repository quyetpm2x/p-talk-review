import type { GameDef } from './types'
import type { Item } from '../lib/picker'
import { FlashCard } from './FlashCard'
import { Quiz } from './Quiz'
import { Listen } from './Listen'
import { Sort } from './Sort'
import { Situation } from './Situation'
import { Synonym } from './Synonym'
import { Scramble, scrambleTokens } from './Scramble'
import { FillBlank } from './FillBlank'
import { SpeakIt } from './SpeakIt'

const need = (n: number, what = 'cụm') => (items: Item[]) =>
  items.length >= n ? null : `Cần ít nhất ${n} ${what} trong bộ đang chọn`

/** Các trò dạng "một câu hỏi" — dùng trong GameShell và Thử thách nhanh. */
export const QUESTION_GAMES: GameDef[] = [
  {
    id: 'flashcard', name: 'Thẻ lật', icon: '🃏', tier: 'nho', autoNext: true,
    desc: 'Lật thẻ xem nghĩa, tự đánh giá nhớ hay chưa',
    eligible: () => true, lockReason: need(1), Question: FlashCard,
  },
  {
    id: 'quiz', name: 'Trắc nghiệm', icon: '✅', tier: 'nho',
    desc: 'Anh → Việt và Việt → Anh, 4 lựa chọn',
    eligible: () => true, lockReason: need(4), Question: Quiz,
  },
  {
    id: 'listen', name: 'Nghe & chọn', icon: '🎧', tier: 'nho',
    desc: 'Nghe phát âm, chọn đúng câu hoặc đúng nghĩa',
    eligible: () => true, lockReason: need(4), Question: Listen,
  },
  {
    id: 'sort', name: 'Phân nhóm', icon: '🗂️', tier: 'hieu',
    desc: 'Cụm này thuộc nhóm nào trong 5 nhóm chức năng?',
    eligible: (i) => !!i.group,
    lockReason: (items) => (items.length ? null : 'Cụm gợi ý thêm không có nhóm — chọn bộ khác'),
    Question: Sort,
  },
  {
    id: 'situation', name: 'Hợp tình huống', icon: '🎯', tier: 'hieu',
    desc: 'Đọc tình huống, chọn câu phù hợp nhất',
    eligible: (i) => !!i.situation, lockReason: need(3, 'cụm có tình huống'), Question: Situation,
  },
  {
    id: 'synonym', name: 'Đồng nghĩa', icon: '🔁', tier: 'hieu',
    desc: 'Tìm câu có nghĩa tương đương',
    eligible: (i) => !!i.synonym, lockReason: need(1, 'cụm có câu đồng nghĩa'), Question: Synonym,
  },
  {
    id: 'scramble', name: 'Sắp xếp từ', icon: '🧩', tier: 'dung',
    desc: 'Ghép các từ bị xáo thành câu đúng',
    eligible: (i) => scrambleTokens(i.en).length >= 3, lockReason: need(1, 'cụm có từ 3 từ trở lên'), Question: Scramble,
  },
  {
    id: 'fill', name: 'Điền từ', icon: '✍️', tier: 'dung',
    desc: 'Gõ từ còn thiếu trong cụm',
    eligible: () => true, lockReason: need(1), Question: FillBlank,
  },
  {
    id: 'speak', name: 'Nói ra', icon: '🎤', tier: 'dung',
    desc: 'Nhìn nghĩa tiếng Việt, nói câu tiếng Anh — máy chấm',
    eligible: () => true, lockReason: need(1), Question: SpeakIt,
  },
]
