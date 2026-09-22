import { useEffect, useMemo, useRef, useState } from 'react'
import type { CustomGameProps, GameDef } from './types'
import { QUESTION_GAMES } from './questions'
import { shuffle } from '../lib/shuffle'
import type { Item } from '../lib/picker'
import { Feedback } from '../components/Feedback'
import { AutoNext, AUTO_DELAY } from '../components/AutoNext'

const MIX = ['quiz', 'listen', 'sort', 'situation', 'synonym', 'scramble', 'fill']
const LIVES = 3
const MAX_Q = 20
const TIME = { default: 15, scramble: 25, fill: 25 } as Record<string, number>

export function Challenge({ lesson, items, pool, record, finish }: CustomGameProps) {
  const games = useMemo(
    () => QUESTION_GAMES.filter((g) => MIX.includes(g.id) && !g.lockReason(pool.filter(g.eligible), 'all')),
    [pool],
  )
  const makeQ = (): { item: Item; game: GameDef } => {
    const item = shuffle(items)[0]
    const ok = games.filter((g) => g.eligible(item))
    return { item, game: shuffle(ok.length ? ok : games)[0] }
  }
  const [q, setQ] = useState(makeQ)
  const [n, setN] = useState(0)
  const [lives, setLives] = useState(LIVES)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [answered, setAnswered] = useState<null | 'ok' | 'bad' | 'timeout'>(null)
  const limit = TIME[q.game.id] ?? TIME.default
  const [left, setLeft] = useState(limit)
  const stats = useRef({ correct: 0, wrong: [] as Item[], answers: [] as { item: Item; correct: boolean }[] })
  const start = useRef(Date.now())
  const scoreRef = useRef(0)
  const livesRef = useRef(lives)
  livesRef.current = lives

  useEffect(() => {
    if (answered) return
    if (left <= 0) {
      handle(false, 0, true)
      return
    }
    const t = setTimeout(() => setLeft((x) => x - 1), 1000)
    return () => clearTimeout(t)
  }, [left, answered]) // eslint-disable-line react-hooks/exhaustive-deps

  function handle(correct: boolean, points: number, timeout = false) {
    if (answered) return
    record(q.item.id, correct)
    stats.current.answers.push({ item: q.item, correct })
    if (correct) {
      const c = combo + 1
      setCombo(c)
      scoreRef.current += points * (c >= 5 ? 2 : 1) + left
      setScore(scoreRef.current)
      stats.current.correct++
      setAnswered('ok')
    } else {
      setCombo(0)
      setLives((l) => l - 1)
      stats.current.wrong.push(q.item)
      setAnswered(timeout ? 'timeout' : 'bad')
    }
  }

  const next = () => {
    const count = n + 1
    if (livesRef.current <= 0 || count >= MAX_Q) {
      finish({ score: scoreRef.current, correct: stats.current.correct, total: count, wrong: stats.current.wrong, answers: stats.current.answers, seconds: Math.round((Date.now() - start.current) / 1000) })
      return
    }
    const nq = makeQ()
    setQ(nq)
    setN(count)
    setAnswered(null)
    setLeft(TIME[nq.game.id] ?? TIME.default)
  }

  const Q = q.game.Question!
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row" style={{ gap: 8 }}>
        <span aria-label={`Còn ${lives} mạng`} style={{ fontSize: 18, letterSpacing: 2 }}>
          {'❤️'.repeat(Math.max(0, lives))}{'🤍'.repeat(LIVES - Math.max(0, lives))}
        </span>
        <span className="grow" />
        {combo >= 2 && <span className="tag accent">🔥 x{combo}{combo >= 5 ? ' · điểm ×2' : ''}</span>}
        <span className="score-pill">{score}</span>
      </div>
      <div className="row small">
        <span className="tag">{q.game.icon} {q.game.name}</span>
        <span className="grow" />
        <span className="muted">Câu {n + 1}/{MAX_Q}</span>
        <strong style={{ color: left <= 5 && !answered ? 'var(--bad)' : undefined, minWidth: 36, textAlign: 'right' }}>⏱ {left}s</strong>
      </div>
      <div className="pbar"><div style={{ width: `${(left / limit) * 100}%`, background: left <= 5 ? 'var(--bad)' : undefined, transition: 'width 1s linear' }} /></div>
      <fieldset disabled={answered === 'timeout'} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <Q key={n} item={q.item} pool={pool} lesson={lesson} onAnswer={(r) => handle(r.correct, r.points)} />
      </fieldset>
      {answered === 'timeout' && <Feedback ok={false} answer={<span lang="en">⏰ Hết giờ! {q.item.en} — {q.item.vi}</span>} />}
      {answered && (
        <AutoNext key={`next-${n}`} ms={answered === 'ok' ? AUTO_DELAY.ok : AUTO_DELAY.bad} onNext={next}
          label={lives <= 0 ? 'Hết mạng — xem thống kê' : n + 1 >= MAX_Q ? 'Xem thống kê' : 'Sang câu tiếp'} />
      )}
    </div>
  )
}
