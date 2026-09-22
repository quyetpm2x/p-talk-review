import { useEffect, useMemo, useState } from 'react'
import type { QuestionProps } from './types'
import { distractors } from '../lib/picker'
import { shuffle } from '../lib/shuffle'
import { Choices } from '../components/Choices'
import { SpeakButton } from '../components/SpeakButton'
import { Feedback } from '../components/Feedback'
import { buzz } from '../lib/haptics'
import { speak } from '../lib/speech'
import { cleanPhrase } from '../lib/scoring'

export function Listen({ item, pool, onAnswer }: QuestionProps) {
  const [mode] = useState<'en' | 'vi'>(() => (Math.random() < 0.5 ? 'en' : 'vi'))
  const opts = useMemo(
    () => shuffle([item, ...distractors(item, pool, 3, mode === 'en' ? (i) => i.en : (i) => i.vi)]),
    [item, pool, mode],
  )
  const [res, setRes] = useState<boolean | null>(null)
  useEffect(() => {
    const t = setTimeout(() => speak(cleanPhrase(item.en)), 250)
    return () => clearTimeout(t)
  }, [item])
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="q-label">{mode === 'en' ? 'Nghe và chọn đúng câu bạn nghe được' : 'Nghe và chọn đúng nghĩa'}</div>
      <div className="card row" style={{ justifyContent: 'center', gap: 20, padding: 24 }}>
        <SpeakButton text={item.en} size="lg" label="Nghe lại" />
        <SpeakButton text={item.en} size="lg" slow label="Nghe chậm" />
      </div>
      <Choices
        lang={mode === 'en' ? 'en' : undefined}
        options={opts.map((o) => ({ label: mode === 'en' ? o.en : o.vi }))}
        correct={opts.indexOf(item)}
        onPick={(_, ok) => {
          setRes(ok)
          buzz(ok)
          onAnswer({ correct: ok, points: ok ? 10 : 0 })
        }}
      />
      {res !== null && <Feedback ok={res} answer={<span lang="en">{item.en} — {item.vi}</span>} />}
    </div>
  )
}
