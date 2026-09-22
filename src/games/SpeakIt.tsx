import { useState } from 'react'
import type { QuestionProps } from './types'
import { cleanPhrase } from '../lib/scoring'
import { SpeechCheck } from '../components/SpeechCheck'
import { Feedback } from '../components/Feedback'
import { buzz } from '../lib/haptics'

export function SpeakIt({ item, onAnswer }: QuestionProps) {
  const target = cleanPhrase(item.en)
  const [res, setRes] = useState<{ passed: boolean } | null>(null)
  const [peek, setPeek] = useState(false)
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="q-label">Nói câu này bằng tiếng Anh</div>
      <div className="card stack" style={{ gap: 8 }}>
        <div className="prompt-vi">{item.vi}</div>
        {!res && (peek
          ? <div className="muted" lang="en">{target.split(' ').map((w) => w[0] + '…').join(' ')}</div>
          : <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setPeek(true)}>👁 Gợi ý chữ cái đầu</button>)}
      </div>
      <SpeechCheck
        target={target}
        onResult={(r) => {
          setRes(r)
          buzz(r.passed)
          onAnswer({ correct: r.passed, points: r.passed ? (r.self ? 10 : 20) : 0 })
        }}
      />
      {res && <Feedback ok={res.passed} speakText={item.en} answer={<span lang="en">{item.en}</span>} />}
    </div>
  )
}
