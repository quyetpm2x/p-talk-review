import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { getLesson } from '../lessons'
import { TopBar } from '../components/TopBar'
import { SpeakButton } from '../components/SpeakButton'
import { useProgress } from '../lib/ProgressContext'
import { useRecorder } from '../lib/recorder'
import { cleanPhrase } from '../lib/scoring'

export function MissionPage() {
  const { id = '', idx = '0' } = useParams()
  const lesson = getLesson(id)
  const m = lesson?.missions[Number(idx)]
  const [p, update] = useProgress()
  const [showToolkit, setShowToolkit] = useState(false)
  const rec = useRecorder()
  if (!lesson || !m) return <><TopBar back="/" title="Không tìm thấy" /><main className="page" /></>

  const key = `${lesson.id}:${idx}`
  const goals = p.missions[key] ?? []
  const done = m.goals.every((_, i) => goals[i])
  const toggle = (i: number) =>
    update((pp) => {
      const cur = [...(pp.missions[key] ?? m.goals.map(() => false))]
      cur[i] = !cur[i]
      return { ...pp, missions: { ...pp.missions, [key]: cur } }
    })

  return (
    <>
      <TopBar back={`/lesson/${lesson.id}/roleplay`} title={m.title} sub={`Mission · ${m.level}`} />
      <main className="page">
        <div className="card stack" style={{ gap: 6 }}>
          <div className="label">🎯 Situation</div>
          <div lang="en">{m.situation}</div>
        </div>
        <div className="card row" style={{ background: 'var(--ink)', color: 'var(--ink-fg)', borderColor: 'var(--ink)' }}>
          <div className="grow">
            <div className="label" style={{ color: 'rgba(255,255,255,.6)' }}>🎬 Kick-off — A</div>
            <div lang="en" style={{ fontWeight: 600, fontSize: 17 }}>“{m.kickoff}”</div>
          </div>
          <SpeakButton text={m.kickoff} />
        </div>

        <div className="card stack" style={{ gap: 4 }}>
          <div className="row">
            <div className="label grow">✅ Your mission — make all of this happen</div>
            {done && <span className="tag accent">Hoàn thành</span>}
          </div>
          {m.goals.map((g, i) => (
            <label key={i} className="goal">
              <input type="checkbox" checked={!!goals[i]} onChange={() => toggle(i)} />
              <span lang="en">{g}</span>
            </label>
          ))}
        </div>

        <div className="card stack" style={{ gap: 12 }}>
          <div className="label">🎙️ Ghi âm lại phần nói của bạn</div>
          {rec.state === 'unsupported' && <div className="muted small">Trình duyệt này chưa hỗ trợ ghi âm.</div>}
          {rec.state === 'denied' && <div className="small" style={{ color: 'var(--bad)' }}>Chưa được cấp quyền micro — hãy cho phép trong cài đặt trình duyệt rồi thử lại.</div>}
          {rec.state !== 'unsupported' && (
            <div className="row" style={{ justifyContent: 'center', gap: 16 }}>
              {rec.state === 'recording' ? (
                <button className="mic-btn on" onClick={rec.stop} aria-label="Dừng ghi">■</button>
              ) : (
                <button className="mic-btn" onClick={rec.start} aria-label="Bắt đầu ghi"><span style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--bad)" }} /></button>
              )}
            </div>
          )}
          <div className="muted small center">
            {rec.state === 'recording' ? 'Đang ghi… bấm ■ để dừng' : rec.url ? 'Nghe lại bên dưới · bấm ⏺ để ghi lại' : 'Bấm ⏺ rồi nói cả đoạn hội thoại của bạn'}
          </div>
          {rec.url && <audio controls src={rec.url} style={{ width: '100%' }} />}
          <div className="muted small center">Bản ghi chỉ lưu tạm, sẽ mất khi rời trang.</div>
        </div>

        <div className="card stack" style={{ gap: 8 }}>
          <div className="label">🔑 Cụm gợi ý thêm</div>
          {m.hints.map((h) => (
            <div key={h.en} className="row">
              <div className="grow">
                <div lang="en" style={{ fontWeight: 600 }}>{h.en}</div>
                <div className="muted small">{h.vi}</div>
              </div>
              <SpeakButton text={cleanPhrase(h.en)} />
            </div>
          ))}
        </div>

        <button className="btn btn-ghost btn-block" onClick={() => setShowToolkit((s) => !s)} aria-expanded={showToolkit}>
          📚 {showToolkit ? 'Ẩn' : 'Xem'} 5 nhóm toolkit
        </button>
        {showToolkit && [...lesson.groups].sort((a, b) => a.order - b.order).map((g) => (
          <div key={g.id} className="card stack" style={{ gap: 6 }}>
            <div className="label">{g.icon} {g.vi} — {g.en}</div>
            {lesson.phrases.filter((ph) => ph.group === g.id).map((ph) => (
              <div key={ph.id} className="row">
                <div className="grow"><span lang="en" style={{ fontWeight: 600 }}>{ph.en}</span> <span className="muted small">{ph.vi}</span></div>
                <SpeakButton text={ph.en} />
              </div>
            ))}
          </div>
        ))}
      </main>
    </>
  )
}
