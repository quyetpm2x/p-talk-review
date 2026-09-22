import { useState } from 'react'
import type { QuestionProps } from './types'
import { shuffle } from '../lib/shuffle'
import { cleanPhrase, normalize } from '../lib/scoring'
import { Feedback } from '../components/Feedback'
import { buzz } from '../lib/haptics'
import { speak } from '../lib/speech'

export const scrambleTokens = (en: string) => cleanPhrase(en).split(/\s+/).filter(Boolean)

export function Scramble({ item, onAnswer }: QuestionProps) {
  const target = scrambleTokens(item.en)
  const [chips] = useState(() => {
    const idx = target.map((_, i) => i)
    let s = shuffle(idx)
    for (let k = 0; k < 5 && s.every((v, i) => v === i); k++) s = shuffle(idx)
    return s.map((i) => ({ key: i, word: target[i] }))
  })
  const [placed, setPlaced] = useState<number[]>([])
  const [hint, setHint] = useState(false)
  const [res, setRes] = useState<boolean | null>(null)

  const check = () => {
    const said = placed.map((k) => chips.find((c) => c.key === k)!.word).join(' ')
    const ok = normalize(said).join(' ') === normalize(target.join(' ')).join(' ')
    setRes(ok)
    buzz(ok)
    speak(target.join(' '))
    onAnswer({ correct: ok, points: ok ? (hint ? 5 : 15) : 0 })
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="q-label">Chạm các từ theo đúng thứ tự để ghép thành câu</div>
      <div className="card stack" style={{ gap: 8 }}>
        <div className="answer-line" lang="en" aria-label="Câu của bạn">
          {placed.length === 0 && <span className="muted small">Câu của bạn sẽ hiện ở đây…</span>}
          {placed.map((k) => (
            <button key={k} className="chip sel" disabled={res !== null} onClick={() => setPlaced((p) => p.filter((x) => x !== k))}>
              {chips.find((c) => c.key === k)!.word}
            </button>
          ))}
        </div>
        {hint ? <div className="muted">💡 {item.vi}</div> : (
          res === null && <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setHint(true)}>💡 Gợi ý nghĩa (−10 điểm)</button>
        )}
      </div>
      <div className="chips" lang="en">
        {chips.map((c) => (
          <button key={c.key} className={`chip ${placed.includes(c.key) ? 'used' : ''}`} disabled={res !== null}
            onClick={() => setPlaced((p) => [...p, c.key])}>
            {c.word}
          </button>
        ))}
      </div>
      {res === null ? (
        <button className="btn btn-primary btn-block" disabled={placed.length !== chips.length} onClick={check}>Kiểm tra</button>
      ) : (
        <Feedback ok={res} answer={<span lang="en">{item.en} — {item.vi}</span>} />
      )}
    </div>
  )
}
