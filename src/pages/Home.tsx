import { Link } from 'react-router-dom'
import { lessons } from '../lessons'
import { useProgress } from '../lib/ProgressContext'
import { currentStreak, lessonPercent } from '../lib/progress'
import { ProgressBar } from '../components/ProgressBar'

export function Home() {
  const [p] = useProgress()
  const streak = currentStreak(p, Date.now())
  const byLevel = lessons.reduce<Record<number, typeof lessons>>((acc, l) => ((acc[l.level] ??= []).push(l), acc), {})
  return (
    <>
      <header className="hero">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="grow">
            <div className="brand gold-text" style={{ fontSize: 34, lineHeight: 1 }}>PTALK</div>
            <div className="hero-sub">— ENGLISH —</div>
            <div className="hero-slogan">SPEAK WITH MASTERY, OWN YOUR DESTINY</div>
          </div>
          <div className="streak" aria-label={`Chuỗi ${streak} ngày`}>
            <div style={{ fontSize: 20, lineHeight: 1 }}>🔥</div>
            <div style={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>{streak}</div>
            <div style={{ fontSize: 10, fontWeight: 700 }}>NGÀY</div>
          </div>
        </div>
        <div className="hero-title">Ôn luyện <span className="gold-text">tiếng Anh giao tiếp</span></div>
        <div style={{ fontSize: 14, opacity: 0.75 }}>Ôn lại bài vừa học — mỗi ngày một chút, nói tự nhiên hơn mỗi ngày.</div>
      </header>
      <main className="page">
        {Object.entries(byLevel).map(([level, ls]) => (
          <section key={level} className="stack">
            <div className="section-bar">Level {level} <em>— {ls.length} bài</em></div>
            {ls.map((l) => {
              const pct = lessonPercent(p, l)
              return (
                <Link key={l.id} to={`/lesson/${l.id}/phrases`} className="card card-link stack" style={{ gap: 12 }}>
                  <div className="row">
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--ink)', color: 'var(--accent)', border: '1.5px solid var(--accent)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 22, flex: 'none', fontFamily: 'var(--font-brand)' }}>
                      {l.number}
                    </div>
                    <div className="grow">
                      <div style={{ fontWeight: 800, fontSize: 17 }}>{l.title}</div>
                      <div className="muted small">{l.titleVi} · {l.phrases.length} cụm từ</div>
                    </div>
                    <span aria-hidden style={{ fontSize: 20 }}>›</span>
                  </div>
                  <div className="row small">
                    <div className="grow"><ProgressBar value={pct} label="Tiến độ ghi nhớ" /></div>
                    <strong>{Math.round(pct)}%</strong>
                  </div>
                </Link>
              )
            })}
          </section>
        ))}
        <p className="muted small center" style={{ marginTop: 'auto' }}>
          Tiến độ được lưu trên máy này. 📲 Thêm vào màn hình chính để mở như app.
        </p>
      </main>
    </>
  )
}
