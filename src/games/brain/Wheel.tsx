import { useEffect, useMemo, useRef, useState, type FC } from 'react'
import type { CustomGameProps, QuestionProps } from '../types'
import type { Item } from '../../lib/picker'
import { pickItems } from '../../lib/picker'
import { shuffle } from '../../lib/shuffle'
import { useProgress } from '../../lib/ProgressContext'
import { sfx } from '../../lib/sfx'
import { burst } from '../../lib/fx'
import { SpeakIt } from '../SpeakIt'
import { FillBlank } from '../FillBlank'
import { Quiz } from '../Quiz'
import { segmentAt, shortGroupName, spinTarget } from './logic'
import './brain.css'

const N = 8
const SEG = 360 / N
const SPINS = 5
const SPIN_MS = 4200
const X2_AT = [3, 7]

type Task = 'speak' | 'write' | 'translate'
const TASKS: { id: Task; name: string; Q: FC<QuestionProps> }[] = [
  { id: 'speak', name: 'Nói', Q: SpeakIt },
  { id: 'write', name: 'Viết', Q: FillBlank },
  { id: 'translate', name: 'Dịch', Q: Quiz },
]
type Seg =
  | { kind: 'task'; group: string | null; icon: string; name: string; task: (typeof TASKS)[number]; color: 'navy' | 'cream' }
  | { kind: 'x2' }

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const pt = (r: number, a: number) => {
  const rad = (a * Math.PI) / 180
  return `${(r * Math.sin(rad)).toFixed(2)} ${(-r * Math.cos(rad)).toFixed(2)}`
}

/** 8 ô: 6 ô "nhóm · nhiệm vụ" xen kẽ navy/kem + 2 ô ⭐ ×2 màu vàng. */
function buildSegments(lesson: CustomGameProps['lesson'], items: Item[]): Seg[] {
  const groups = shuffle(
    lesson.groups.filter((g) => items.some((i) => i.group === g.id))
      .map((g) => ({ group: g.id as string | null, icon: g.icon, name: shortGroupName(g.vi) })),
  )
  const gs = groups.length ? groups : [{ group: null, icon: '✨', name: 'Cụm thêm' }]
  const off = Math.floor(Math.random() * 3)
  const out: Seg[] = []
  let k = 0
  for (let i = 0; i < N; i++) {
    if (X2_AT.includes(i)) { out.push({ kind: 'x2' }); continue }
    const g = gs[k % gs.length]
    out.push({ kind: 'task', ...g, task: TASKS[(k + off) % 3], color: k % 2 ? 'cream' : 'navy' })
    k++
  }
  return out
}

type Phase = 'idle' | 'spinning' | 'landed' | 'question' | 'answered'

export function Wheel({ lesson, items, pool, record, finish }: CustomGameProps) {
  const [p] = useProgress()
  const segs = useMemo(() => buildSegments(lesson, items), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [rot, setRot] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [hit, setHit] = useState<number | null>(null)
  const [mult, setMult] = useState(1)
  const [turn, setTurn] = useState(0) // số câu đã làm
  const [item, setItem] = useState<Item | null>(null)
  const [last, setLast] = useState<{ correct: boolean; points: number } | null>(null)
  const [score, setScore] = useState(0)
  const [msg, setMsg] = useState<string | null>(null)
  const scoreRef = useRef(0)
  const answers = useRef<{ item: Item; correct: boolean }[]>([])
  const used = useRef(new Set<string>())
  const start = useRef(Date.now())
  const wheelRef = useRef<SVGGElement>(null)
  const target = useRef(0)
  const landed = useRef(true)
  const timers = useRef<number[]>([])
  const raf = useRef(0)
  useEffect(() => () => { timers.current.forEach(clearTimeout); cancelAnimationFrame(raf.current) }, [])

  const seg = hit !== null ? segs[hit] : null

  /** Chọn 1 cụm của nhóm, ưu tiên cụm chưa hỏi trong ván này. */
  const pickFor = (s: Extract<Seg, { kind: 'task' }>): Item => {
    const inGroup = items.filter((i) => (s.group ? i.group === s.group : true))
    const fresh = inGroup.filter((i) => !used.current.has(i.id))
    const list = fresh.length ? fresh : inGroup.length ? inGroup : items
    return pickItems(list, p.phrases, lesson.id, 3, Date.now())[Math.floor(Math.random() * Math.min(3, list.length))] ?? list[0]
  }

  const land = () => {
    if (landed.current) return
    landed.current = true
    cancelAnimationFrame(raf.current)
    const idx = segmentAt(target.current, N)
    const s = segs[idx]
    setHit(idx)
    setPhase('landed')
    if (s.kind === 'x2') {
      sfx('boost')
      setMult(2)
      setMsg('⭐ Nhân đôi! Câu kế tiếp được ×2 điểm — quay tiếp nào!')
      timers.current.push(window.setTimeout(() => setPhase('idle'), 1100))
      return
    }
    sfx('go')
    const it = pickFor(s)
    used.current.add(it.id)
    setItem(it)
    timers.current.push(window.setTimeout(() => { setMsg(null); setPhase('question') }, 1100))
  }

  const spin = () => {
    if (phase !== 'idle') return
    setMsg(null)
    setHit(null)
    const idx = Math.floor(Math.random() * N)
    const next = spinTarget(rot, idx, N, 5 + Math.floor(Math.random() * 2), (Math.random() - 0.5) * SEG * 0.7)
    target.current = next
    landed.current = false
    setPhase('spinning')
    setRot(next)
    sfx('whoosh')
    if (reduced()) {
      timers.current.push(window.setTimeout(land, 60))
      return
    }
    // Phòng khi transitionend không bắn
    timers.current.push(window.setTimeout(land, SPIN_MS + 400))
    // Tiếng tick mỗi khi kim qua một ô
    let lastSeg = segmentAt(rot, N), lastT = 0
    const loop = (t: number) => {
      const el = wheelRef.current
      if (el) {
        const m = getComputedStyle(el).transform
        const v = m && m !== 'none' ? m.slice(m.indexOf('(') + 1, -1).split(',').map(Number) : [1, 0]
        const ang = (Math.atan2(v[1], v[0]) * 180) / Math.PI
        const sgm = segmentAt(ang, N)
        if (sgm !== lastSeg && t - lastT > 35) { sfx('tick'); lastT = t }
        lastSeg = sgm
      }
      if (!landed.current) raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
  }

  const onAnswer = (r: { correct: boolean; points: number }) => {
    if (!item || last) return
    const pts = r.points * mult
    record(item.id, r.correct)
    answers.current.push({ item, correct: r.correct })
    scoreRef.current += pts
    setScore(scoreRef.current)
    setLast({ correct: r.correct, points: pts })
    setPhase('answered')
    if (r.correct && mult > 1) burst(innerWidth / 2, 140, 30)
  }

  const nextTurn = () => {
    const t = turn + 1
    if (t >= SPINS) {
      const a = answers.current
      finish({
        score: scoreRef.current,
        correct: a.filter((x) => x.correct).length,
        total: a.length,
        wrong: a.filter((x) => !x.correct).map((x) => x.item),
        answers: a,
        seconds: Math.round((Date.now() - start.current) / 1000),
      })
      return
    }
    setMult(1)
    setTurn(t)
    setItem(null)
    setLast(null)
    setHit(null)
    setPhase('idle')
  }

  const inQuestion = phase === 'question' || phase === 'answered'
  const taskSeg = seg && seg.kind === 'task' ? seg : null

  return (
    <div className="stack wheel-game" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 8 }}>
        <div className="wheel-dots grow" aria-label={`Lượt ${Math.min(turn + 1, SPINS)}/${SPINS}`}>
          {Array.from({ length: SPINS }, (_, i) => {
            const a = answers.current[i]
            return <i key={i} className={a ? (a.correct ? 'ok' : 'bad') : i === turn ? 'cur' : ''} />
          })}
        </div>
        {mult > 1 && <span className="tag accent wheel-x2">⭐ ×2</span>}
        <span className="score-pill">{score}</span>
      </div>

      {!inQuestion ? (
        <>
          <div className="wheel-wrap">
            <div className="wheel-pointer" aria-hidden />
            <svg className="wheel-svg" viewBox="-112 -112 224 224" role="img"
              aria-label={taskSeg ? `Dừng ở ô ${taskSeg.name} · ${taskSeg.task.name}` : seg ? 'Dừng ở ô nhân đôi điểm' : 'Vòng quay 8 ô'}>
              <defs>
                <linearGradient id="wheel-gold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#f3dc9f" /><stop offset="0.55" stopColor="#d4ad5e" /><stop offset="1" stopColor="#a97d35" />
                </linearGradient>
              </defs>
              <circle r="110" className="wheel-rim" />
              {Array.from({ length: 16 }, (_, i) => (
                <circle key={i} r="2.6" cx={105 * Math.sin((i * Math.PI) / 8)} cy={-105 * Math.cos((i * Math.PI) / 8)}
                  className={`wheel-bulb ${phase === 'spinning' ? 'blink' : ''}`} style={{ animationDelay: `${(i % 2) * 0.25}s` }} />
              ))}
              <g ref={wheelRef} className="wheel-rot" style={{
                transform: `rotate(${rot}deg)`,
                transition: phase === 'spinning' && !reduced() ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.72, 0.16, 1)` : 'none',
              }} onTransitionEnd={(e) => e.target === e.currentTarget && land()}>
                {segs.map((s, i) => {
                  const a0 = i * SEG, a1 = a0 + SEG
                  const cls = s.kind === 'x2' ? 'gold' : s.color
                  // Nửa trái: lật chữ 180° để khi đứng yên không bị ngược
                  const flip = a0 + SEG / 2 > 180
                  const x = flip ? -60 : 60, xb = flip ? -64 : 64
                  return (
                    <g key={i} className={`wheel-seg ${cls} ${hit === i && phase !== 'spinning' ? 'hit' : ''}`}>
                      <path d={`M0 0 L${pt(100, a0)} A100 100 0 0 1 ${pt(100, a1)} Z`} />
                      <g transform={`rotate(${a0 + SEG / 2}) rotate(${flip ? 90 : -90})`}>
                        {s.kind === 'x2' ? (
                          <>
                            <text x={xb} y="0" className="wl-big" textAnchor="middle" dominantBaseline="central">⭐</text>
                            <text x={xb} y="15" className="wl-task" textAnchor="middle">×2 ĐIỂM</text>
                          </>
                        ) : (
                          <>
                            <text x={x} y="-3" className="wl-name" textAnchor="middle">{s.icon} {s.name}</text>
                            <text x={x} y="11" className="wl-task" textAnchor="middle">{s.task.name.toUpperCase()}</text>
                          </>
                        )}
                      </g>
                    </g>
                  )
                })}
              </g>
              <circle r="17" className="wheel-hub" />
              <text className="wheel-hub-t" textAnchor="middle" dominantBaseline="central">P</text>
            </svg>
          </div>

          <div className="wheel-msg" role="status" aria-live="polite">
            {phase === 'landed' && taskSeg
              ? <span className="pop-in">{taskSeg.icon} <b>{taskSeg.name}</b> · nhiệm vụ <b>{taskSeg.task.name}</b>!</span>
              : msg ?? (phase === 'spinning' ? 'Đang quay…' : `Lượt ${turn + 1}/${SPINS} — quay để nhận nhiệm vụ`)}
          </div>
          <button className="btn btn-primary btn-block wheel-btn" onClick={spin} disabled={phase !== 'idle'}>
            🎡 {phase === 'idle' ? 'Quay!' : 'Đang quay…'}
          </button>
          <div className="muted small center">Nói = đọc to câu · Viết = điền từ · Dịch = chọn nghĩa đúng</div>
        </>
      ) : (
        item && taskSeg && (
          <>
            <div className="wheel-banner">
              <span>{taskSeg.icon} {taskSeg.name}</span>
              <b>· {taskSeg.task.name}</b>
              {mult > 1 && <span className="tag accent">⭐ ×2 điểm</span>}
            </div>
            <taskSeg.task.Q key={turn} item={item} pool={pool} lesson={lesson} onAnswer={onAnswer} />
            {phase === 'answered' && (
              <button className="btn btn-dark btn-block pop-in" onClick={nextTurn}>
                {last && last.points > 0 ? `+${last.points} điểm · ` : ''}{turn + 1 >= SPINS ? 'Xem kết quả' : 'Quay tiếp →'}
              </button>
            )}
          </>
        )
      )}
    </div>
  )
}
