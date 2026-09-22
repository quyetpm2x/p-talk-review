import { useMemo, useState } from 'react'
import type { QuestionProps } from './types'
import { distractors } from '../lib/picker'
import { shuffle } from '../lib/shuffle'
import { Choices } from '../components/Choices'
import { Feedback } from '../components/Feedback'
import { buzz } from '../lib/haptics'
import { speak } from '../lib/speech'
import { cleanPhrase } from '../lib/scoring'

export function Situation({ item, pool, onAnswer }: QuestionProps) {
  const opts = useMemo(() => shuffle([item, ...distractors(item, pool, 2, (i) => i.en)]), [item, pool])
  const [res, setRes] = useState<boolean | null>(null)
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="q-label">Trong tình huống này, bạn sẽ nói gì?</div>
      <div className="card" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)' }}>
        <div className="label" style={{ color: 'var(--fg)' }}>🎯 Tình huống</div>
        <div className="prompt-vi" style={{ marginTop: 6 }}>{item.situation}</div>
      </div>
      <Choices
        lang="en"
        options={opts.map((o) => ({ label: o.en }))}
        correct={opts.indexOf(item)}
        onPick={(_, ok) => {
          setRes(ok)
          buzz(ok)
          speak(cleanPhrase(item.en))
          onAnswer({ correct: ok, points: ok ? 10 : 0 })
        }}
      />
      {res !== null && <Feedback ok={res} answer={<span lang="en">{item.en} — {item.vi}</span>} />}
    </div>
  )
}
