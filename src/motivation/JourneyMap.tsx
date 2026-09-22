import { Link } from 'react-router-dom'
import type { Lesson } from '../types'
import type { Progress } from '../lib/progress'
import { lessonPercent } from '../lib/progress'
import '../styles/motivation.css'

type Stop =
  | { kind: 'lesson'; lesson: Lesson; pct: number; state: 'done' | 'current' | 'open' }
  | { kind: 'soon'; n: number }

/** Số trạm "Sắp ra mắt" hiển thị sau các bài hiện có. */
const SOON = 4
const STEP = 132 // khoảng cách dọc giữa các trạm (px)
const TOP = 70 // chừa chỗ cho nhãn "Bắt đầu" phía trên trạm đầu tiên
const XS = [50, 74, 50, 26] // vị trí ngang (%) — đường zigzag
const R = 40 // bán kính vòng tiến độ
const C = 2 * Math.PI * R

/** Trạng thái các trạm: ≥ 80% = đã xong, bài đầu tiên chưa xong = đang học. */
export function buildStops(p: Progress, lessons: Lesson[]): Stop[] {
  let cur = false
  const stops: Stop[] = lessons.map((lesson) => {
    const pct = lessonPercent(p, lesson)
    const state = pct >= 80 ? 'done' : cur ? 'open' : ((cur = true), 'current')
    return { kind: 'lesson', lesson, pct, state }
  })
  const last = lessons.length ? Math.max(...lessons.map((l) => l.number)) : 0
  for (let i = 1; i <= SOON; i++) stops.push({ kind: 'soon', n: last + i })
  return stops
}

/** Bản đồ hành trình kiểu Duolingo: các trạm tròn nối bằng đường cong zigzag. */
export function JourneyMap({ p, lessons }: { p: Progress; lessons: Lesson[] }) {
  const stops = buildStops(p, lessons)
  const pts = stops.map((_, i) => ({ x: XS[i % XS.length], y: TOP + i * STEP + R }))
  const H = pts[pts.length - 1].y + R + 64
  const seg = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    `M${a.x} ${a.y} C${a.x} ${a.y + STEP / 2} ${b.x} ${b.y - STEP / 2} ${b.x} ${b.y}`
  const real = stops.filter((s) => s.kind === 'lesson').length

  return (
    <div className="jm" style={{ height: H }}>
      <svg className="jm-path" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden>
        {pts.slice(1).map((b, i) => (
          <path key={i} d={seg(pts[i], b)} className={i + 1 < real ? 'on' : 'off'} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {stops.map((s, i) => {
        const pos = { left: `${pts[i].x}%`, top: pts[i].y }
        if (s.kind === 'soon')
          return (
            <div key={`soon${s.n}`} className="jm-stop" style={pos}>
              <div className="jm-node soon" aria-label={`Bài ${s.n} — sắp ra mắt`}>
                <span className="jm-disc"><span className="jm-num">{s.n}</span><span className="jm-lock" aria-hidden>🔒</span></span>
              </div>
              <div className="jm-label"><b>Bài {s.n}</b><span>Sắp ra mắt 🔒</span></div>
            </div>
          )
        const { lesson: l, pct, state } = s
        const stateVi = state === 'done' ? 'đã hoàn thành' : state === 'current' ? 'đang học' : 'đã mở'
        return (
          <div key={l.id} className="jm-stop" style={pos}>
            {state === 'current' && <div className="jm-callout" aria-hidden>{pct > 0 ? 'TIẾP TỤC' : 'BẮT ĐẦU'}</div>}
            <Link to={`/lesson/${l.id}/phrases`} className={`jm-node ${state}`}
              aria-label={`Bài ${l.number}: ${l.title} — ${stateVi}, ${Math.round(pct)}%`}>
              <svg className="jm-ring" viewBox="0 0 96 96" aria-hidden>
                <circle cx={48} cy={48} r={R} className="bg" />
                <circle cx={48} cy={48} r={R} className="fg" strokeDasharray={`${(C * Math.min(100, pct)) / 100} ${C}`} />
              </svg>
              <span className="jm-disc">
                {state === 'done' ? <span className="jm-crown" aria-hidden>👑</span> : null}
                <span className="jm-num">{l.number}</span>
              </span>
            </Link>
            <div className="jm-label">
              <b>{l.title}</b>
              <span>{state === 'done' ? '✅ Đã hoàn thành' : `${l.titleVi} · ${Math.round(pct)}%`}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
