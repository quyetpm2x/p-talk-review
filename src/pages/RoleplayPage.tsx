import { Link, useParams } from 'react-router-dom'
import { getLesson } from '../lessons'
import { useProgress } from '../lib/ProgressContext'

export const MODES = [
  { id: 'listen', icon: '🎧', name: 'Nghe' },
  { id: 'fill', icon: '🧩', name: 'Điền cụm' },
  { id: 'act', icon: '🎭', name: 'Đóng vai' },
] as const

export function RoleplayPage() {
  const { id = '' } = useParams()
  const lesson = getLesson(id)!
  const [p] = useProgress()
  return (
    <>
      <div className="section-bar">Đọc mẫu <em>— nghe, điền cụm, đóng vai</em></div>
      {lesson.dialogues.map((d, i) => (
        <div key={i} className="card stack" style={{ gap: 12 }}>
          <div>
            <div className="label">Hội thoại {i + 1} · {d.setting}</div>
            <div style={{ fontWeight: 800, fontSize: 17 }} lang="en">{d.title}</div>
          </div>
          <div className="grid-3">
            {MODES.map((m) => {
              const best = p.bestScores[`${lesson.id}:dlg${i}:${m.id}`]
              return (
                <Link key={m.id} to={`/lesson/${lesson.id}/roleplay/dialogue/${i}/${m.id}`} className="mode-btn">
                  <span style={{ fontSize: 22 }} aria-hidden>{m.icon}</span>
                  <span>{m.name}</span>
                  {best !== undefined && m.id !== 'listen' && <span className="small muted">⭐ {best}{m.id === 'act' ? '%' : ''}</span>}
                </Link>
              )
            })}
          </div>
        </div>
      ))}

      <div className="section-bar">Mission card <em>— tự nhập vai với bạn học</em></div>
      {lesson.missions.map((m, i) => {
        const goals = p.missions[`${lesson.id}:${i}`] ?? []
        const done = goals.filter(Boolean).length
        const complete = done === m.goals.length
        return (
          <Link key={i} to={`/lesson/${lesson.id}/roleplay/mission/${i}`} className="card card-link stack" style={{ gap: 8 }}>
            <div className="row">
              <span className="tag">{m.level === 'nhẹ' ? 'MISSION · nhẹ' : m.level === 'tổng hợp' ? 'MISSION · tổng hợp' : 'MISSION'}</span>
              <span className="grow" />
              {complete ? <span className="tag accent">✅ Hoàn thành</span> : <span className="small muted">{done}/{m.goals.length} mục tiêu</span>}
            </div>
            <div style={{ fontWeight: 800 }} lang="en">{m.title}</div>
            <div className="muted small" lang="en">“{m.kickoff}”</div>
          </Link>
        )
      })}
    </>
  )
}
