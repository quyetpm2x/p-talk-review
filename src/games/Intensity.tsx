import { useMemo, useState } from 'react'
import type { CustomGameProps } from './types'
import { shuffle } from '../lib/shuffle'
import type { Item } from '../lib/picker'
import { SpeakButton } from '../components/SpeakButton'
import { buzz } from '../lib/haptics'
import { AutoNext } from '../components/AutoNext'

/** Tạo các bộ 3 cụm có độ bất ngờ khác nhau. */
function makeRounds(items: Item[], max: number): Item[][] {
  const by = [3, 2, 1].map((lv) => items.filter((i) => i.intensity === lv))
  if (by.some((b) => !b.length)) return []
  const combos = by[0].length * by[1].length * by[2].length
  const n = Math.min(max, combos)
  const seen = new Set<string>()
  const out: Item[][] = []
  for (let k = 0; out.length < n && k < 50; k++) {
    const set = by.map((b) => shuffle(b)[0])
    const key = set.map((i) => i.id).join()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(set)
  }
  return out
}

export function Intensity({ items, record, finish }: CustomGameProps) {
  const rounds = useMemo(() => makeRounds(items, 3), [items])
  const [round, setRound] = useState(0)
  const answer = rounds[round] // mạnh → nhẹ
  const [cards] = useState(() => rounds.map((r) => shuffle(r)))
  const [placed, setPlaced] = useState<string[]>([])
  const [checked, setChecked] = useState<boolean | null>(null)
  const [score, setScore] = useState(0)
  const [stats, setStats] = useState({ correct: 0, wrong: [] as Item[] })

  const check = () => {
    const ok = placed.every((id, i) => answer[i].id === id)
    placed.forEach((id, i) => record(id, answer[i].id === id))
    buzz(ok)
    setChecked(ok)
    if (ok) setScore((s) => s + 30)
    setStats((s) => ({ correct: s.correct + (ok ? 1 : 0), wrong: ok ? s.wrong : [...s.wrong, ...answer] }))
  }
  const next = () => {
    if (round + 1 < rounds.length) { setRound(round + 1); setPlaced([]); setChecked(null) }
    else finish({ score, correct: stats.correct, total: rounds.length, wrong: stats.wrong })
  }
  const labels = ['😱 Bất ngờ nhất', '😮 Vừa vừa', '🙂 Hơi bất ngờ']

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row">
        <div className="q-label grow">Lượt {round + 1}/{rounds.length} · xếp từ <strong>bất ngờ nhất</strong> đến <strong>nhẹ nhất</strong></div>
        <span className="score-pill">{score}</span>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        {answer.map((a, i) => {
          const id = placed[i]
          const it = id ? answer.find((x) => x.id === id) : undefined
          const ok = checked !== null && id === a.id
          return (
            <div key={i} className={`choice ${checked !== null ? (ok ? 'ok' : 'bad') : ''}`}>
              <span className="grow">
                <div className="label">{labels[i]}</div>
                <div lang="en" style={{ fontWeight: 600 }}>{it ? it.en : <span className="muted">…</span>}</div>
                {checked !== null && (
                  <div className="small" style={{ marginTop: 4 }}>
                    {!ok && <div style={{ color: 'var(--ok)' }} lang="en">✓ {a.en}</div>}
                    <span className="muted">{a.vi}{a.note ? ` — ${a.note}` : ''}</span>
                  </div>
                )}
              </span>
              {it && checked === null && <button className="icon-btn" aria-label="Bỏ" onClick={() => setPlaced((p) => p.filter((x) => x !== id))}>✕</button>}
              {checked !== null && <SpeakButton text={a.en} />}
            </div>
          )
        })}
      </div>
      {checked === null && (
        <div className="chips" lang="en">
          {cards[round].map((c) => (
            <button key={c.id} className={`chip ${placed.includes(c.id) ? 'used' : ''}`} onClick={() => setPlaced((p) => [...p, c.id])}>{c.en}</button>
          ))}
        </div>
      )}
      <div className="sticky-bottom">
        {checked === null
          ? <button className="btn btn-primary btn-block" disabled={placed.length !== answer.length} onClick={check}>Kiểm tra</button>
          : <AutoNext key={round} ms={3500} onNext={next} label={round + 1 < rounds.length ? 'Sang lượt tiếp' : 'Xem thống kê'} />}
      </div>
    </div>
  )
}

export const intensityRoundsAvailable = (items: Item[]) => makeRounds(items, 1).length > 0
