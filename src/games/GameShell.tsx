import { useState } from 'react'
import type { CustomGameProps, GameDef } from './types'
import { pickItems, type Item } from '../lib/picker'
import { useProgress } from '../lib/ProgressContext'
import { ProgressBar } from '../components/ProgressBar'

/** Khung chung cho trò dạng từng câu: chọn 10 cụm, đếm điểm, chuyển câu. */
export function GameShell({ def, lesson, items, pool, record, finish, fixed }: CustomGameProps & { def: GameDef; fixed?: Item[] }) {
  const [p] = useProgress()
  const [list] = useState(() => fixed ?? pickItems(items, p.phrases, lesson.id, def.perRound ?? 10, Date.now()))
  const [i, setI] = useState(0)
  const [answered, setAnswered] = useState(false)
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState<Item[]>([])
  const Q = def.Question!
  const item = list[i]

  const next = (s = score, c = correct, w = wrong) => {
    if (i + 1 < list.length) {
      setI(i + 1)
      setAnswered(false)
    } else finish({ score: s, correct: c, total: list.length, wrong: w })
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="game-head">
        <span className="small muted" style={{ minWidth: 40 }}>{i + 1}/{list.length}</span>
        <ProgressBar value={((i + (answered ? 1 : 0)) / list.length) * 100} />
        {!def.autoNext && <span className="score-pill">{score}</span>}
      </div>
      <Q key={i} item={item} pool={pool} lesson={lesson} onAnswer={(r) => {
        if (answered) return
        record(item.id, r.correct)
        const s = score + r.points
        const c = correct + (r.correct ? 1 : 0)
        const w = r.correct ? wrong : [...wrong, item]
        setScore(s)
        setCorrect(c)
        setWrong(w)
        if (def.autoNext) next(s, c, w)
        else setAnswered(true)
      }} />
      {answered && (
        <div className="sticky-bottom">
          <button className="btn btn-primary btn-block" autoFocus onClick={() => next()}>
            {i + 1 < list.length ? 'Tiếp tục →' : 'Xem kết quả'}
          </button>
        </div>
      )}
    </div>
  )
}
