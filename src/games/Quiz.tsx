import { useMemo, useState } from 'react'
import type { QuestionProps } from './types'
import { distractors } from '../lib/picker'
import { shuffle } from '../lib/shuffle'
import { Choices } from '../components/Choices'
import { SpeakButton } from '../components/SpeakButton'
import { Feedback } from '../components/Feedback'
import { buzz } from '../lib/haptics'
import { speak } from '../lib/speech'
import { cleanPhrase } from '../lib/scoring'

export function Quiz({ item, pool, onAnswer }: QuestionProps) {
  const [dir] = useState<'en2vi' | 'vi2en'>(() => (Math.random() < 0.5 ? 'en2vi' : 'vi2en'))
  const opts = useMemo(
    () => shuffle([item, ...distractors(item, pool, 3, dir === 'en2vi' ? (i) => i.vi : (i) => i.en)]),
    [item, pool, dir],
  )
  const [res, setRes] = useState<boolean | null>(null)
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="q-label">{dir === 'en2vi' ? 'Cụm này nghĩa là gì?' : 'Nói câu này bằng tiếng Anh thế nào?'}</div>
      <div className="card row">
        {dir === 'en2vi' ? (
          <>
            <div className="prompt grow" lang="en">{item.en}</div>
            <SpeakButton text={item.en} />
          </>
        ) : (
          <div className="prompt-vi grow">{item.vi}</div>
        )}
      </div>
      <Choices
        lang={dir === 'vi2en' ? 'en' : undefined}
        options={opts.map((o) => ({ label: dir === 'en2vi' ? o.vi : o.en }))}
        correct={opts.indexOf(item)}
        onPick={(_, ok) => {
          setRes(ok)
          buzz(ok)
          if (dir === 'vi2en' || ok) speak(cleanPhrase(item.en))
          onAnswer({ correct: ok, points: ok ? 10 : 0 })
        }}
      />
      {res !== null && <Feedback ok={res} answer={<span lang="en">{item.en} — {item.vi}</span>} />}
    </div>
  )
}
