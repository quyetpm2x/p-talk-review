import { useEffect, useMemo, useRef, useState } from 'react'
import type { CustomGameProps } from './types'
import { shuffle } from '../lib/shuffle'
import { pickItems, type Item } from '../lib/picker'
import { useProgress } from '../lib/ProgressContext'
import { buzz } from '../lib/haptics'
import { speak } from '../lib/speech'
import { cleanPhrase } from '../lib/scoring'

const PER = 5
const PENALTY = 3

export function Match({ lesson, items, record, finish }: CustomGameProps) {
  const [p] = useProgress()
  const rounds = useMemo(() => {
    const picked = pickItems(items, p.phrases, lesson.id, PER * 2, Date.now())
    const r: Item[][] = []
    for (let i = 0; i < picked.length; i += PER) r.push(picked.slice(i, i + PER))
    return r.filter((x) => x.length >= 2)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [round, setRound] = useState(0)
  const cur = rounds[round] ?? []
  const left = useMemo(() => shuffle(cur), [cur])
  const right = useMemo(() => shuffle(cur), [cur])
  const [selL, setSelL] = useState<string | null>(null)
  const [selR, setSelR] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [missed, setMissed] = useState<Set<string>>(new Set())
  const [shake, setShake] = useState<string | null>(null)
  const [penalty, setPenalty] = useState(0)
  const start = useRef(Date.now())
  const [now, setNow] = useState(Date.now())
  const allWrong = useRef<Item[]>([])
  const correctCount = useRef(0)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])
  const secs = Math.floor((now - start.current) / 1000) + penalty

  const tryPair = (l: string | null, r: string | null) => {
    if (!l || !r) return
    if (l === r) {
      buzz(true)
      const it = cur.find((i) => i.id === l)!
      speak(cleanPhrase(it.en))
      const ok = !missed.has(l)
      record(l, ok)
      if (ok) correctCount.current++
      else allWrong.current.push(it)
      const nd = new Set(done).add(l)
      setDone(nd)
      setSelL(null)
      setSelR(null)
      if (nd.size === cur.length) {
        setTimeout(() => {
          if (round + 1 < rounds.length) {
            setRound(round + 1)
            setDone(new Set())
            setMissed(new Set())
          } else {
            const total = Math.floor((Date.now() - start.current) / 1000) + penalty
            finish({ score: Math.max(0, 300 - total), correct: correctCount.current, total: rounds.flat().length, wrong: allWrong.current, seconds: total })
          }
        }, 450)
      }
    } else {
      buzz(false)
      setMissed(new Set(missed).add(l))
      setPenalty((x) => x + PENALTY)
      setShake(l + '|' + r)
      setTimeout(() => { setShake(null); setSelL(null); setSelR(null) }, 350)
    }
  }

  const btn = (id: string, label: string, side: 'L' | 'R') => {
    const sel = side === 'L' ? selL === id : selR === id
    const isDone = done.has(id)
    const shaking = shake && (side === 'L' ? shake.startsWith(id + '|') : shake.endsWith('|' + id))
    return (
      <button key={side + id} lang={side === 'L' ? 'en' : undefined} disabled={isDone}
        className={`choice ${isDone ? 'ok' : ''} ${sel ? 'picked' : ''} ${shaking ? 'bad shake' : ''}`}
        style={{ minHeight: 64, fontSize: 15, opacity: isDone ? 0.45 : 1 }}
        onClick={() => {
          if (side === 'L') { setSelL(id); tryPair(id, selR) } else { setSelR(id); tryPair(selL, id) }
        }}>
        {label}
      </button>
    )
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row">
        <div className="q-label grow">Vòng {round + 1}/{rounds.length} · chạm 1 câu bên trái và nghĩa của nó bên phải</div>
        <span className="score-pill" aria-label="Thời gian">⏱ {secs}s</span>
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="stack">{left.map((i) => btn(i.id, i.en, 'L'))}</div>
        <div className="stack">{right.map((i) => btn(i.id, i.vi, 'R'))}</div>
      </div>
      <div className="muted small center">Chọn sai bị cộng {PENALTY} giây · điểm = 300 − số giây</div>
    </div>
  )
}
