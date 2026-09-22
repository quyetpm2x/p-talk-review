import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CustomGameProps } from '../types'
import { pickItems, type Item } from '../../lib/picker'
import { useProgress } from '../../lib/ProgressContext'
import { speak } from '../../lib/speech'
import { cleanPhrase } from '../../lib/scoring'
import { sfx } from '../../lib/sfx'
import { buzz } from '../../lib/haptics'
import { burst } from '../../lib/fx'
import { SpeakButton } from '../../components/SpeakButton'
import { ProgressBar } from '../../components/ProgressBar'
import { mergeKeys, scoreGuess, splitAtKey, wordleKey, wordlePoints, type Mark } from './logic'
import './brain.css'

const ROUNDS = 5
const TRIES = 6
const STEP = 260 // ms giữa 2 ô khi lật
const KB = ['qwertyuiop', 'asdfghjkl', '+zxcvbnm-']

/** Cụm chơi được Wordle: có từ khoá 3–8 chữ và tìm thấy từ đó trong câu. */
export const wordleEligible = (i: Item) => {
  const k = wordleKey(i)
  return !!k && !!splitAtKey(i.en, k)
}

export function Wordle({ lesson, items, record, finish }: CustomGameProps) {
  const [p] = useProgress()
  const list = useMemo(() => pickItems(items, p.phrases, lesson.id, ROUNDS, Date.now()), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const answers = useRef<{ item: Item; correct: boolean }[]>([])
  const start = useRef(Date.now())
  const scoreRef = useRef(0)

  const done = (item: Item, solved: boolean, pts: number) => {
    record(item.id, solved)
    answers.current.push({ item, correct: solved })
    scoreRef.current += pts
    setScore(scoreRef.current)
  }
  const next = () => {
    if (idx + 1 < list.length) return setIdx(idx + 1)
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
    <div className="stack wordle" style={{ gap: 10 }}>
      <div className="game-head">
        <span className="small muted" style={{ minWidth: 34 }}>{idx + 1}/{list.length}</span>
        <ProgressBar value={(answers.current.length / list.length) * 100} />
        <span className="score-pill">{score}</span>
      </div>
      <Round key={idx} item={list[idx]} last={idx + 1 >= list.length} onDone={done} onNext={next} />
    </div>
  )
}

function Round({ item, last, onDone, onNext }: {
  item: Item; last: boolean; onDone: (i: Item, solved: boolean, pts: number) => void; onNext: () => void
}) {
  const answer = wordleKey(item)!
  const parts = splitAtKey(item.en, answer)!
  const n = answer.length
  const [rows, setRows] = useState<{ word: string; marks: Mark[] }[]>([])
  const [cur, setCur] = useState('')
  const [keys, setKeys] = useState<Record<string, Mark>>({})
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<'play' | 'won' | 'lost'>('play')
  const [bad, setBad] = useState<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const submit = useCallback(() => {
    if (busy || status !== 'play') return
    if (cur.length < n) {
      setBad(`Cần đủ ${n} chữ cái`)
      buzz(false)
      timers.current.push(window.setTimeout(() => setBad(null), 900))
      return
    }
    const marks = scoreGuess(cur, answer)
    const nextRows = [...rows, { word: cur, marks }]
    setRows(nextRows)
    setCur('')
    setBusy(true)
    for (let i = 0; i < n; i++) timers.current.push(window.setTimeout(() => sfx('tick'), i * STEP + STEP / 2))
    timers.current.push(window.setTimeout(() => {
      setBusy(false)
      setKeys((k) => mergeKeys(k, cur, marks))
      const won = marks.every((m) => m === 'ok')
      if (won || nextRows.length >= TRIES) {
        setStatus(won ? 'won' : 'lost')
        onDone(item, won, wordlePoints(nextRows.length, won))
        buzz(won)
        sfx(won ? 'win' : 'lose')
        if (won && boardRef.current) {
          const r = boardRef.current.getBoundingClientRect()
          burst(r.left + r.width / 2, r.top + r.height * (nextRows.length / TRIES), 40)
        }
        timers.current.push(window.setTimeout(() => speak(cleanPhrase(item.en)), 400))
      }
    }, n * STEP + 250))
  }, [busy, status, cur, n, answer, rows, item, onDone])

  const press = useCallback((k: string) => {
    if (status !== 'play' || busy) return
    if (k === '+') return submit()
    if (k === '-') return setCur((c) => c.slice(0, -1))
    if (/^[a-z]$/.test(k)) setCur((c) => (c.length < n ? c + k : c))
  }, [status, busy, submit, n])

  // Bàn phím thật
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key
      if (k === 'Enter') {
        e.preventDefault()
        if (status !== 'play') onNext()
        else press('+')
      } else if (k === 'Backspace') press('-')
      else if (/^[a-zA-Z]$/.test(k)) press(k.toLowerCase())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press, status, onNext])

  const over = status !== 'play'
  const grid = Array.from({ length: TRIES }, (_, r) => rows[r] ?? (r === rows.length ? { word: cur, marks: null } : { word: '', marks: null }))

  return (
    <>
      <div className="card wordle-clue" style={{ padding: '12px 14px' }}>
        <div className="prompt" lang="en" style={{ fontSize: 21 }}>
          {parts[0]}
          <span className={`w-gap ${over ? 'filled' : ''}`}>{over ? parts[1] : '_'.repeat(n)}</span>
          {parts[2]}
        </div>
        <div className="muted" style={{ marginTop: 2 }}>{item.vi}</div>
      </div>

      <div ref={boardRef} className="w-board" style={{ '--n': n } as React.CSSProperties} aria-label="Bảng đoán">
        {grid.map((row, r) => (
          <div key={r} className={`w-row ${bad && r === rows.length ? 'shake' : ''} ${status === 'won' && r === rows.length - 1 ? 'win' : ''}`}>
            {Array.from({ length: n }, (_, c) => {
              const ch = row.word[c] ?? ''
              const m = row.marks?.[c]
              return (
                <div key={c} className={`w-tile ${ch ? 'has' : ''} ${m ? `rev ${m}` : ''}`}
                  style={{ '--d': `${c * STEP}ms`, '--wd': `${c * 90}ms` } as React.CSSProperties}>
                  {ch}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div className="w-toast" role="status" aria-live="polite">{bad ?? (busy ? '' : status === 'play' ? `Lượt ${Math.min(rows.length + 1, TRIES)}/${TRIES} · từ có ${n} chữ cái` : '')}</div>

      {over ? (
        <div className={`feedback ${status === 'won' ? 'ok' : 'bad'} pop-in`}>
          <div className="row">
            <strong className="grow">
              {status === 'won' ? `🎉 Đoán đúng sau ${rows.length} lượt! +${wordlePoints(rows.length, true)}` : `😅 Hết lượt — từ đúng là “${answer.toUpperCase()}”`}
            </strong>
            <SpeakButton text={item.en} />
          </div>
          <div className="answer" lang="en">{item.en}</div>
          <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} onClick={onNext}>
            {last ? 'Xem kết quả' : 'Cụm tiếp →'}
          </button>
        </div>
      ) : (
        <div className="w-kb" aria-label="Bàn phím">
          {KB.map((row, i) => (
            <div key={i} className="w-kb-row">
              {i === 1 && <span className="w-kb-half" />}
              {row.split('').map((k) => (
                <button key={k} type="button" disabled={busy}
                  className={`w-key ${k === '+' || k === '-' ? 'wide' : ''} ${keys[k] ?? ''}`}
                  aria-label={k === '+' ? 'Đoán' : k === '-' ? 'Xoá' : k}
                  onClick={() => press(k)}>
                  {k === '+' ? 'ĐOÁN' : k === '-' ? '⌫' : k}
                </button>
              ))}
              {i === 1 && <span className="w-kb-half" />}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
