import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getLesson } from '../lessons'
import type { Dialogue } from '../types'
import { TopBar } from '../components/TopBar'
import { Highlight, splitToolkit } from '../components/Highlight'
import { SpeakButton } from '../components/SpeakButton'
import { SpeechCheck } from '../components/SpeechCheck'
import { speak, stopSpeaking } from '../lib/speech'
import { shuffle } from '../lib/shuffle'
import { buzz } from '../lib/haptics'
import { useProgress } from '../lib/ProgressContext'
import { setBest } from '../lib/progress'
import { MODES } from './RoleplayPage'

export function DialoguePage() {
  const { id = '', idx = '0', mode = 'listen' } = useParams()
  const lesson = getLesson(id)
  const d = lesson?.dialogues[Number(idx)]
  useEffect(() => () => stopSpeaking(), [])
  if (!lesson || !d) return <><TopBar back="/" title="Không tìm thấy" /><main className="page" /></>
  const bestKey = `${lesson.id}:dlg${idx}:${mode}`
  return (
    <>
      <TopBar back={`/lesson/${lesson.id}/roleplay`} title={d.title} sub={`Hội thoại ${Number(idx) + 1} · ${d.setting}`} />
      <main className="page">
        <div className="grid-3">
          {MODES.map((m) => (
            <Link key={m.id} replace to={`/lesson/${lesson.id}/roleplay/dialogue/${idx}/${m.id}`} className={`mode-btn ${m.id === mode ? 'on' : ''}`}
              style={{ minHeight: 56, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
              <span aria-hidden>{m.icon}</span> {m.name}
            </Link>
          ))}
        </div>
        {mode === 'listen' && <ListenMode key={idx} d={d} />}
        {mode === 'fill' && <FillMode key={idx} d={d} bestKey={bestKey} />}
        {mode === 'act' && <ActMode key={idx} d={d} bestKey={bestKey} />}
      </main>
    </>
  )
}

function Bubble({ speaker, active, mine, children }: { speaker: 'A' | 'B'; active?: boolean; mine?: boolean; children: React.ReactNode }) {
  return (
    <div className={`bubble-row ${speaker}`}>
      <span className="avatar" aria-label={`Vai ${speaker}`}>{speaker}</span>
      <div className={`bubble ${active ? 'active' : ''} ${mine ? 'mine' : ''}`} lang="en">{children}</div>
    </div>
  )
}

function NewWords({ d }: { d: Dialogue }) {
  if (!d.newWords.length) return null
  return (
    <div className="card stack" style={{ gap: 8 }}>
      <div className="label">📝 Từ mới</div>
      {d.newWords.map((w) => (
        <div key={w.en} className="row">
          <div className="grow">
            <strong lang="en">{w.en}</strong> <span lang="en">= {w.meaning}</span>
            <div className="muted small">{w.vi}</div>
          </div>
          <SpeakButton text={w.en} />
        </div>
      ))}
    </div>
  )
}

/* ---------- Nghe ---------- */
function ListenMode({ d }: { d: Dialogue }) {
  const [active, setActive] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const stopRef = useRef(false)

  const playFrom = async (start: number) => {
    stopRef.current = false
    setPlaying(true)
    for (let i = start; i < d.lines.length && !stopRef.current; i++) {
      setActive(i)
      await speak(d.lines[i].text, { voice: d.lines[i].speaker })
      await new Promise((r) => setTimeout(r, 250))
    }
    setPlaying(false)
    setActive(null)
  }
  const stop = () => {
    stopRef.current = true
    stopSpeaking()
    setPlaying(false)
    setActive(null)
  }
  useEffect(() => () => { stopRef.current = true }, [])

  return (
    <>
      <button className={`btn btn-block ${playing ? 'btn-dark' : 'btn-primary'}`} onClick={() => (playing ? stop() : playFrom(0))}>
        {playing ? '■ Dừng' : '▶ Nghe cả bài'}
      </button>
      <div className="muted small center">Chạm vào một câu để nghe riêng câu đó · <b style={{ background: 'var(--accent-soft)' }}>tô vàng</b> = cụm toolkit</div>
      <div className="chat">
        {d.lines.map((ln, i) => (
          <button key={i} onClick={() => { stop(); setActive(i); speak(ln.text, { voice: ln.speaker }).then(() => setActive(null)) }}
            style={{ all: 'unset', cursor: 'pointer' }} aria-label={`Nghe câu ${i + 1}`}>
            <Bubble speaker={ln.speaker} active={active === i}><Highlight text={ln.text} toolkit={ln.toolkit} /></Bubble>
          </button>
        ))}
      </div>
      <NewWords d={d} />
    </>
  )
}

/* ---------- Điền cụm ---------- */
type Blank = { line: number; k: number; text: string }

function FillMode({ d, bestKey }: { d: Dialogue; bestKey: string }) {
  const [p, update] = useProgress()
  const blanks = useMemo<Blank[]>(
    () => d.lines.flatMap((ln, line) => splitToolkit(ln.text, ln.toolkit).filter((s) => s.k !== undefined).map((s) => ({ line, k: s.k!, text: s.t }))),
    [d],
  )
  const [run, setRun] = useState(0)
  const bank = useMemo(() => shuffle(blanks.map((b, i) => ({ i, text: b.text }))), [blanks, run]) // eslint-disable-line react-hooks/exhaustive-deps
  const [filled, setFilled] = useState<number[]>([]) // chỉ số blank đã điền
  const [used, setUsed] = useState<number[]>([]) // chỉ số bank đã dùng
  const [missed, setMissed] = useState<Set<number>>(new Set())
  const [shake, setShake] = useState<number | null>(null)
  const cur = filled.length
  const done = cur === blanks.length
  const score = filled.filter((b) => !missed.has(b)).length * 10
  const prevBest = useRef(p.bestScores[bestKey] ?? 0)

  useEffect(() => {
    if (done && blanks.length) update((pp) => setBest(pp, bestKey, score))
  }, [done]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cur > 0) document.querySelector('.slot.active')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [cur])

  const pick = (bi: number) => {
    if (done) return
    const want = blanks[cur].text.toLowerCase()
    if (bank[bi].text.toLowerCase() === want) {
      buzz(true)
      setUsed((u) => [...u, bi])
      setFilled((f) => [...f, cur])
      speak(d.lines[blanks[cur].line].text, { voice: d.lines[blanks[cur].line].speaker })
    } else {
      buzz(false)
      setMissed((m) => new Set(m).add(cur))
      setShake(bi)
      setTimeout(() => setShake(null), 300)
    }
  }
  const reset = () => {
    setRun((r) => r + 1)
    setFilled([])
    setUsed([])
    setMissed(new Set())
    prevBest.current = Math.max(prevBest.current, score)
  }

  return (
    <>
      <div className="row">
        <div className="q-label grow">Chọn cụm đúng cho ô đang sáng · {cur}/{blanks.length}</div>
        <span className="score-pill">{score}</span>
      </div>
      <div className="chat">
        {d.lines.map((ln, li) => (
          <Bubble key={li} speaker={ln.speaker} active={!done && blanks[cur]?.line === li}>
            {splitToolkit(ln.text, ln.toolkit).map((s, si) => {
              if (s.k === undefined) return <span key={si}>{s.t}</span>
              const bi = blanks.findIndex((b) => b.line === li && b.k === s.k)
              const isFilled = filled.includes(bi)
              const cls = isFilled ? (missed.has(bi) ? 'missed' : 'filled') : bi === cur ? 'active' : ''
              return <span key={si} className={`slot ${cls}`}>{isFilled ? s.t : bi === cur ? '?' : ' '.repeat(6)}</span>
            })}
          </Bubble>
        ))}
      </div>
      {done ? (
        <div className="card center stack">
          <div style={{ fontSize: 40 }}>{score === blanks.length * 10 ? '🏆' : '🎉'}</div>
          <strong>{score} / {blanks.length * 10} điểm</strong>
          {score > prevBest.current && <span className="tag accent" style={{ alignSelf: 'center' }}>⭐ Kỷ lục mới!</span>}
          <button className="btn btn-primary btn-block" onClick={reset}>↻ Làm lại</button>
        </div>
      ) : (
        <div className="sticky-bottom">
          <div className="chips" lang="en" style={{ justifyContent: 'center' }}>
            {bank.map((b, bi) => used.includes(bi) ? null : (
              <button key={bi} className={`chip ${shake === bi ? 'shake' : ''}`}
                style={shake === bi ? { borderColor: 'var(--bad)' } : undefined} onClick={() => pick(bi)}>
                {b.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

/* ---------- Đóng vai ---------- */
function ActMode({ d, bestKey }: { d: Dialogue; bestKey: string }) {
  const [, update] = useProgress()
  const [role, setRole] = useState<'A' | 'B' | null>(null)
  const [step, setStep] = useState(0)
  const [results, setResults] = useState<Record<number, boolean>>({})
  const [reveal, setReveal] = useState(false)
  const [run, setRun] = useState(0)
  const endRef = useRef<HTMLDivElement>(null)
  const done = role !== null && step >= d.lines.length
  const mine = d.lines.map((l, i) => (l.speaker === role ? i : -1)).filter((i) => i >= 0)
  const passed = mine.filter((i) => results[i]).length
  const pct = mine.length ? Math.round((passed / mine.length) * 100) : 0

  useEffect(() => {
    if (!role || done) return
    const ln = d.lines[step]
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    if (ln.speaker !== role) {
      let alive = true
      speak(ln.text, { voice: ln.speaker }).then(() => alive && setTimeout(() => alive && setStep((s) => s + 1), 300))
      return () => { alive = false }
    }
  }, [role, step, run]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (done) update((pp) => setBest(pp, bestKey, pct))
  }, [done]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!role)
    return (
      <div className="card stack center" style={{ gap: 14, padding: 22 }}>
        <div style={{ fontSize: 40 }}>🎭</div>
        <strong>Bạn muốn đóng vai nào?</strong>
        <div className="muted small">Máy sẽ đọc lời vai còn lại. Đến lượt bạn thì bấm micro và nói.</div>
        <div className="grid-2">
          {(['A', 'B'] as const).map((r) => (
            <button key={r} className="btn btn-dark" onClick={() => setRole(r)}>
              Vai {r}
            </button>
          ))}
        </div>
      </div>
    )

  const restart = () => { stopSpeaking(); setStep(0); setResults({}); setReveal(false); setRun((x) => x + 1) }

  return (
    <>
      <div className="row small">
        <span className="tag accent">Bạn là vai {role}</span>
        <span className="grow" />
        <button className="btn btn-ghost btn-sm" onClick={() => { stopSpeaking(); setRole(null); setStep(0); setResults({}) }}>Đổi vai</button>
      </div>
      <div className="chat">
        {d.lines.slice(0, Math.min(step + 1, d.lines.length)).map((ln, i) => {
          const isMine = ln.speaker === role
          const current = i === step && !done
          return (
            <Bubble key={i} speaker={ln.speaker} active={current} mine={isMine}>
              {isMine && current && !reveal ? <span className="blur" aria-label="Câu của bạn (đang ẩn)">{ln.text}</span> : <Highlight text={ln.text} toolkit={ln.toolkit} />}
              {isMine && i in results && <div className="small" style={{ marginTop: 4 }}>{results[i] ? '✅ Đạt' : '⚠️ Chưa đạt'}</div>}
            </Bubble>
          )
        })}
      </div>
      {!done && d.lines[step].speaker === role && (
        <div className="card stack" key={`${run}-${step}`}>
          <div className="row">
            <strong className="grow">Đến lượt bạn!</strong>
            <button className="btn btn-ghost btn-sm" onClick={() => setReveal((r) => !r)}>{reveal ? '🙈 Ẩn câu' : '👁 Xem câu'}</button>
            <SpeakButton text={d.lines[step].text} voice={role} label="Nghe câu mẫu" />
          </div>
          <SpeechCheck target={d.lines[step].text} onResult={(r) => {
            buzz(r.passed)
            setResults((x) => ({ ...x, [step]: r.passed }))
            setReveal(false)
            setTimeout(() => setStep((s) => s + 1), 900)
          }} />
        </div>
      )}
      {!done && d.lines[step].speaker !== role && <div className="muted small center">🔊 Vai {d.lines[step].speaker} đang nói…</div>}
      {done && (
        <div className="card center stack">
          <div style={{ fontSize: 40 }}>{pct === 100 ? '🏆' : pct >= 60 ? '🎉' : '💪'}</div>
          <strong>Đạt {passed}/{mine.length} câu ({pct}%)</strong>
          <div className="grid-2">
            <button className="btn btn-ghost" onClick={() => { setRole(role === 'A' ? 'B' : 'A'); restart() }}>Đổi sang vai {role === 'A' ? 'B' : 'A'}</button>
            <button className="btn btn-primary" onClick={restart}>↻ Làm lại</button>
          </div>
        </div>
      )}
      <div ref={endRef} />
    </>
  )
}
