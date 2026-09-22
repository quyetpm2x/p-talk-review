import { useState } from 'react'
import type { QuestionProps } from './types'
import { SpeakButton } from '../components/SpeakButton'
import { buzz } from '../lib/haptics'

export function FlashCard({ item, lesson, onAnswer }: QuestionProps) {
  const [flipped, setFlipped] = useState(false)
  const group = lesson.groups.find((g) => g.id === item.group)
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="q-label">Chạm vào thẻ để lật · tự đánh giá mình đã nhớ chưa</div>
      <div className="flip" onClick={() => setFlipped((f) => !f)} role="button" tabIndex={0} aria-label="Lật thẻ"
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setFlipped((f) => !f)}>
        <div className={`flip-inner ${flipped ? 'flipped' : ''}`}>
          <div className="flip-face card">
            {group && <span className="tag">{group.icon} {group.vi}</span>}
            {item.extra && <span className="tag accent">Cụm gợi ý thêm</span>}
            <div className="prompt" lang="en">{item.en}</div>
            <SpeakButton text={item.en} size="lg" />
            <div className="muted small">Chạm để xem nghĩa ↻</div>
          </div>
          <div className="flip-face flip-back card">
            <div className="prompt-vi">{item.vi}</div>
            {item.synonym && (
              <div className="stack" style={{ gap: 2 }}>
                <div className="label">Đồng nghĩa</div>
                <div lang="en" style={{ fontWeight: 600 }}>{item.synonym}</div>
              </div>
            )}
            {item.note && <div className="muted small">💡 {item.note}</div>}
            <div className="muted small" lang="en">{item.en}</div>
          </div>
        </div>
      </div>
      <div className="grid-2">
        <button className="btn btn-ghost" onClick={() => { buzz(false); onAnswer({ correct: false, points: 0 }) }}>😕 Chưa nhớ</button>
        <button className="btn btn-primary" onClick={() => { buzz(true); onAnswer({ correct: true, points: 0 }) }}>✅ Nhớ rồi</button>
      </div>
    </div>
  )
}
