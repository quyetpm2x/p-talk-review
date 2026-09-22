import { useRef, useState } from 'react'
import type { CustomGameProps, GameDef } from './types'
import { pickItems, type Item } from '../lib/picker'
import { useProgress } from '../lib/ProgressContext'
import { ProgressBar } from '../components/ProgressBar'
import { AutoNext, AUTO_DELAY } from '../components/AutoNext'
import { sfx } from '../lib/sfx'

/** Khung chung cho trò dạng từng câu: chọn 10 cụm, đếm điểm, tự chuyển câu. */
export function GameShell({ def, lesson, items, pool, record, finish, fixed }: CustomGameProps & { def: GameDef; fixed?: Item[] }) {
  const [p] = useProgress()
  const [list] = useState(() => fixed ?? pickItems(items, p.phrases, lesson.id, def.perRound ?? 10, Date.now()))
  const [i, setI] = useState(0)
  const [last, setLast] = useState<boolean | null>(null)
  const [score, setScore] = useState(0)
  const answers = useRef<{ item: Item; correct: boolean }[]>([])
  const scoreRef = useRef(0)
  const start = useRef(Date.now())
  const Q = def.Question!
  const item = list[i]

  const next = () => {
    if (i + 1 < list.length) {
      setI(i + 1)
      setLast(null)
      return
    }
    const a = answers.current
    finish({
      score: scoreRef.current,
      correct: a.filter((x) => x.correct).length,
      total: list.length,
      wrong: a.filter((x) => !x.correct).map((x) => x.item),
      answers: a,
      seconds: Math.round((Date.now() - start.current) / 1000),
    })
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="game-head">
        <span className="small muted" style={{ minWidth: 40 }}>{i + 1}/{list.length}</span>
        <ProgressBar value={((i + (last !== null ? 1 : 0)) / list.length) * 100} />
        {!def.autoNext && <span className="score-pill">{score}</span>}
      </div>
      <Q key={i} item={item} pool={pool} lesson={lesson} onAnswer={(r) => {
        if (last !== null) return
        record(item.id, r.correct)
        if (!def.autoNext) sfx(r.correct ? 'ok' : 'bad') // thẻ lật không phát âm đúng/sai
        answers.current = [...answers.current, { item, correct: r.correct }]
        scoreRef.current += r.points
        setScore(scoreRef.current)
        if (def.autoNext) next()
        else setLast(r.correct)
      }} />
      {last !== null && (
        <AutoNext key={`next-${i}`} ms={last ? AUTO_DELAY.ok : AUTO_DELAY.bad} onNext={next}
          label={i + 1 < list.length ? 'Sang câu tiếp' : 'Xem thống kê'} />
      )}
    </div>
  )
}
