import { Link, NavLink } from 'react-router-dom'
import type { Lesson } from '../types'
import { lessons } from '../lessons'
import { useProgress } from '../lib/ProgressContext'
import { lessonStatus } from '../lib/completion'

/** Dải “Mục tiêu hoàn thành bài” ở đầu mỗi bài: 3 ô (Cụm từ · Nhập vai · Ngữ pháp), chạm để tới phần đó. */
export function LessonGoals({ lesson }: { lesson: Lesson }) {
  const [p] = useProgress()
  const s = lessonStatus(p, lesson)
  const met = s.parts.filter((x) => x.done).length
  // Phương án A: mọi bài luôn mở — chỉ nhắc nhẹ nếu bài trước chưa hoàn thành
  const prev = lessons.filter((l) => l.level === lesson.level && l.number < lesson.number).sort((a, b) => b.number - a.number)[0]
  const prevOpen = prev && !lessonStatus(p, prev).done
  return (
    <section className={`card lesson-goals ${s.done ? 'all-done' : ''}`} aria-label="Mục tiêu hoàn thành bài">
      <div className="row lg-head">
        <b className="grow">{s.done ? '👑 Đã hoàn thành bài này!' : '🎯 Mục tiêu hoàn thành bài'}</b>
        <span className={`tag ${s.done ? 'accent' : ''}`}>{met}/3</span>
      </div>
      <div className="lg-parts">
        {s.parts.map((x) => (
          <NavLink key={x.id} to={`/lesson/${lesson.id}/${x.tab}`} replace className={`lg-part ${x.done ? 'done' : ''}`}
            aria-label={`${x.label}: ${x.done ? 'đã đạt' : 'chưa đạt'} — ${x.detail}`}>
            <span className="lg-top"><span aria-hidden>{x.done ? '✅' : x.icon}</span><b>{x.label}</b></span>
            <span className="lg-bar" aria-hidden><i style={{ width: `${Math.round(x.progress * 100)}%` }} /></span>
            <span className="lg-detail">{x.detail}</span>
          </NavLink>
        ))}
      </div>
      {prevOpen && (
        <Link to={`/lesson/${prev.id}/phrases`} className="lg-prev small">
          💡 Bài {prev.number} chưa hoàn thành — ôn thêm khi rảnh nhé →
        </Link>
      )}
    </section>
  )
}
