import { useMemo, useState } from 'react'
import type { QuestionProps } from './types'
import { distractors } from '../lib/picker'
import { shuffle } from '../lib/shuffle'
import { Choices } from '../components/Choices'
import { SpeakButton } from '../components/SpeakButton'
import { Feedback } from '../components/Feedback'
import { buzz } from '../lib/haptics'

export function Synonym({ item, pool, onAnswer }: QuestionProps) {
  const [dir] = useState<'toSyn' | 'toEn'>(() => (Math.random() < 0.6 ? 'toSyn' : 'toEn'))
  const withSyn = useMemo(() => pool.filter((i) => i.synonym), [pool])
  const opts = useMemo(
    () => shuffle([item, ...distractors(item, withSyn, 3, dir === 'toSyn' ? (i) => i.synonym : (i) => i.en)]),
    [item, withSyn, dir],
  )
  const [res, setRes] = useState<boolean | null>(null)
  const prompt = dir === 'toSyn' ? item.en : item.synonym!
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="q-label">Câu nào có nghĩa gần nhất?</div>
      <div className="card row">
        <div className="prompt grow" lang="en">{prompt}</div>
        <SpeakButton text={prompt} />
      </div>
      <Choices
        lang="en"
        options={opts.map((o) => ({ label: dir === 'toSyn' ? o.synonym! : o.en }))}
        correct={opts.indexOf(item)}
        onPick={(_, ok) => {
          setRes(ok)
          buzz(ok)
          onAnswer({ correct: ok, points: ok ? 10 : 0 })
        }}
      />
      {res !== null && <Feedback ok={res} answer={<span lang="en">{item.en} = {item.synonym} <span className="muted">({item.vi})</span></span>} />}
    </div>
  )
}
