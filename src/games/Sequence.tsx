import { useMemo, useState } from 'react'
import type { CustomGameProps } from './types'
import { shuffle } from '../lib/shuffle'
import type { Item } from '../lib/picker'
import { buzz } from '../lib/haptics'
import { AutoNext } from '../components/AutoNext'

const ROUNDS = 3

export function Sequence({ lesson, items, record, finish }: CustomGameProps) {
  const groups = useMemo(() => [...lesson.groups].sort((a, b) => a.order - b.order), [lesson])
  const rounds = useMemo(
    () => Array.from({ length: ROUNDS }, () =>
      groups.map((g) => shuffle(items.filter((i) => i.group === g.id))[0]).filter(Boolean) as Item[]),
    [groups, items],
  )
  const [round, setRound] = useState(0)
  const correctOrder = rounds[round]
  const [cards] = useState(() => rounds.map((r) => shuffle(r)))
  const [placed, setPlaced] = useState<string[]>([])
  const [checked, setChecked] = useState(false)
  const [score, setScore] = useState(0)
  const [stats, setStats] = useState({ correct: 0, total: 0, wrong: [] as Item[] })

  const check = () => {
    let pts = 0
    const wrong: Item[] = []
    placed.forEach((id, i) => {
      const ok = correctOrder[i].id === id
      record(id, ok)
      if (ok) pts += 10
      else wrong.push(correctOrder.find((x) => x.id === id)!)
    })
    buzz(wrong.length === 0)
    setScore((s) => s + pts)
    setStats((s) => ({ correct: s.correct + placed.length - wrong.length, total: s.total + placed.length, wrong: [...s.wrong, ...wrong] }))
    setChecked(true)
  }

  const next = () => {
    if (round + 1 < rounds.length) {
      setRound(round + 1)
      setPlaced([])
      setChecked(false)
    } else finish({ score, correct: stats.correct, total: stats.total, wrong: stats.wrong })
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row">
        <div className="q-label grow">Lượt {round + 1}/{rounds.length} · xếp các câu theo trình tự một cuộc gặp lại</div>
        <span className="score-pill">{score}</span>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        {correctOrder.map((c, i) => {
          const id = placed[i]
          const it = id ? correctOrder.find((x) => x.id === id) : undefined
          const ok = checked && id === c.id
          return (
            <div key={i} className={`choice ${checked ? (ok ? 'ok' : 'bad') : ''}`} style={{ minHeight: 56 }}>
              <span className="key">{i + 1}</span>
              <span className="grow" lang="en">
                {it ? it.en : <span className="muted small">…</span>}
                {checked && !ok && <div className="small" style={{ color: 'var(--ok)' }}>✓ {c.en}</div>}
                {checked && <div className="muted small">{groups[i].icon} {groups[i].vi}</div>}
              </span>
              {it && !checked && (
                <button className="icon-btn" aria-label="Bỏ câu này" onClick={() => setPlaced((p) => p.filter((x) => x !== id))}>✕</button>
              )}
            </div>
          )
        })}
      </div>
      {!checked && (
        <div className="chips" lang="en">
          {cards[round].map((c) => (
            <button key={c.id} className={`chip ${placed.includes(c.id) ? 'used' : ''}`} onClick={() => setPlaced((p) => [...p, c.id])}>
              {c.en}
            </button>
          ))}
        </div>
      )}
      <div className="sticky-bottom">
        {checked ? (
          <AutoNext key={round} ms={3500} onNext={next} label={round + 1 < rounds.length ? 'Sang lượt tiếp' : 'Xem thống kê'} />
        ) : (
          <button className="btn btn-primary btn-block" disabled={placed.length !== correctOrder.length} onClick={check}>Kiểm tra</button>
        )}
      </div>
    </div>
  )
}
