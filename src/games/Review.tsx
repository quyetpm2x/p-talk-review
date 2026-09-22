import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CustomGameProps } from './types'
import { hardest } from '../lib/picker'
import { useProgress } from '../lib/ProgressContext'
import { FlashCard } from './FlashCard'
import { Quiz } from './Quiz'
import { ProgressBar } from '../components/ProgressBar'
import { AutoNext, AUTO_DELAY } from '../components/AutoNext'
import type { Item } from '../lib/picker'

export function Review({ lesson, items, pool, record, finish }: CustomGameProps) {
  const [p] = useProgress()
  const nav = useNavigate()
  const list = useMemo(() => hardest(items, p.phrases, lesson.id, 10), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [phase, setPhase] = useState<'card' | 'quiz'>('card')
  const [i, setI] = useState(0)
  const [answered, setAnswered] = useState<boolean | null>(null)
  const [answers, setAnswers] = useState<{ item: Item; correct: boolean }[]>([])
  const [start] = useState(() => Date.now())
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState<typeof list>([])

  if (!list.length)
    return (
      <div className="card center stack" style={{ padding: 28 }}>
        <div style={{ fontSize: 48 }}>🎉</div>
        <strong>Chưa có câu sai nào!</strong>
        <div className="muted">Chơi vài trò khác trước — những câu bạn trả lời sai sẽ được gom về đây để ôn lại.</div>
        <button className="btn btn-primary" onClick={() => nav(-1)}>Chọn trò khác</button>
      </div>
    )

  const item = list[i]
  const total = list.length * 2
  const step = (phase === 'card' ? 0 : list.length) + i

  const advance = () => {
    setAnswered(null)
    if (i + 1 < list.length) setI(i + 1)
    else if (phase === 'card') { setPhase('quiz'); setI(0) }
    else finish({ score, correct, total: list.length, wrong, answers, seconds: Math.round((Date.now() - start) / 1000) })
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="game-head">
        <ProgressBar value={(step / total) * 100} />
        <span className="score-pill">{score}</span>
      </div>
      <span className="tag accent" style={{ alignSelf: 'flex-start' }}>
        {phase === 'card' ? `Bước 1/2 · Xem lại ${list.length} cụm hay sai` : 'Bước 2/2 · Kiểm tra lại'}
      </span>
      {phase === 'card' ? (
        <FlashCard key={'c' + i} item={item} pool={pool} lesson={lesson} onAnswer={(r) => { record(item.id, r.correct); advance() }} />
      ) : (
        <Quiz key={'q' + i} item={item} pool={pool} lesson={lesson} onAnswer={(r) => {
          record(item.id, r.correct)
          setScore((s) => s + r.points)
          if (r.correct) setCorrect((c) => c + 1)
          else setWrong((w) => [...w, item])
          setAnswers((a) => [...a, { item, correct: r.correct }])
          setAnswered(r.correct)
        }} />
      )}
      {answered !== null && (
        <AutoNext key={`next-${i}`} ms={answered ? AUTO_DELAY.ok : AUTO_DELAY.bad} onNext={advance}
          label={i + 1 < list.length ? 'Sang câu tiếp' : 'Xem thống kê'} />
      )}
    </div>
  )
}
