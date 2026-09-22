import { useState } from 'react'
import type { QuestionProps } from './types'
import { SpeakButton } from '../components/SpeakButton'
import { Feedback } from '../components/Feedback'
import { buzz } from '../lib/haptics'

export function Sort({ item, lesson, onAnswer }: QuestionProps) {
  const [picked, setPicked] = useState<string | null>(null)
  const groups = [...lesson.groups].sort((a, b) => a.order - b.order)
  const right = lesson.groups.find((g) => g.id === item.group)
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="q-label">Cụm này dùng để làm gì?</div>
      <div className="card row">
        <div className="grow">
          <div className="prompt" lang="en">{item.en}</div>
          <div className="muted small">{item.vi}</div>
        </div>
        <SpeakButton text={item.en} />
      </div>
      <div className="choices">
        {groups.map((g) => {
          let cls = 'choice'
          if (picked) cls += g.id === item.group ? ' ok' : g.id === picked ? ' bad' : ' dim'
          return (
            <button key={g.id} className={cls} disabled={!!picked} onClick={() => {
              setPicked(g.id)
              const ok = g.id === item.group
              buzz(ok)
              onAnswer({ correct: ok, points: ok ? 10 : 0 })
            }}>
              <span className="key" aria-hidden>{g.icon}</span>
              <span className="grow">{g.vi}<div className="muted small">{g.en}</div></span>
            </button>
          )
        })}
      </div>
      {picked && <Feedback ok={picked === item.group} answer={right && `${right.icon} ${right.vi} — ${right.en}`} />}
    </div>
  )
}
