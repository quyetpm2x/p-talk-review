import { useCallback, useState } from 'react'
import { lessons } from '../lessons'
import { useProgress } from '../lib/ProgressContext'
import { currentStreak } from '../lib/progress'
import { MascotSay } from '../motivation/Mascot'
import { JourneyMap } from '../motivation/JourneyMap'
import { DailyQuests, questsLeft } from '../motivation/DailyQuests'
import { BadgesSheet } from '../motivation/BadgesSheet'
import { SoundToggle } from '../motivation/SoundToggle'
import { BADGES } from '../motivation/badges'
import { levelInfo, levelTitle } from '../motivation/xp'
import '../styles/motivation.css'

/** Lời chào theo giờ trong ngày. */
function greeting(h: number) {
  if (h < 11) return 'Chào buổi sáng!'
  if (h < 14) return 'Chào buổi trưa!'
  if (h < 18) return 'Chào buổi chiều!'
  return 'Chào buổi tối!'
}

export function Home() {
  const [p] = useProgress()
  const [sheet, setSheet] = useState(false)
  const closeSheet = useCallback(() => setSheet(false), [])
  const now = Date.now()
  const streak = currentStreak(p, now)
  const lv = levelInfo(p.xp)
  const left = questsLeft(p, now)
  const nBadges = BADGES.filter((b) => b.id in p.badges).length
  const byLevel: Record<number, typeof lessons> = {}
  for (const l of lessons) {
    byLevel[l.level] ??= []
    byLevel[l.level].push(l)
  }
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
        <div className="hero-stats">
          <div className="hero-lvl grow" aria-label={`Cấp ${lv.level}, ${lv.into}/${lv.need} XP`}>
            <span className="xp-lvl sm" aria-hidden>{lv.level}</span>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="hero-lvl-name">Cấp {lv.level} · {levelTitle(lv.level)}</div>
              <div className="xp-bar sm" aria-hidden><div style={{ width: `${lv.pct}%` }} /></div>
              <div className="hero-lvl-xp">{lv.into}/{lv.need} XP · tổng {p.xp} XP</div>
            </div>
          </div>
          <button className="hero-chip-btn wide" onClick={() => setSheet(true)} aria-label={`Huy hiệu: đã có ${nBadges}/${BADGES.length}`}>
            <span aria-hidden>🏅</span><b>{nBadges}</b>
          </button>
          <SoundToggle />
        </div>
      </header>
      <main className="page">
        <div className="card greet-card">
          <MascotSay mood={left ? 'idle' : 'cheer'} size={76}>
            <b>{greeting(new Date(now).getHours())}</b>{' '}
            {left
              ? <>Hôm nay còn <b>{left} nhiệm vụ</b> — làm xong nhận thêm XP nhé!</>
              : <>Bạn đã xong hết nhiệm vụ hôm nay. Tuyệt vời! 🎉</>}
          </MascotSay>
        </div>

        <DailyQuests p={p} now={now} />

        {Object.entries(byLevel).map(([level, ls]) => (
          <section key={level} className="stack">
            <div className="section-bar">Hành trình Level {level} <em>— {ls.length} bài</em></div>
            <JourneyMap p={p} lessons={ls} />
          </section>
        ))}

        <section className="card badge-strip">
          <div className="row">
            <div className="grow">
              <div className="quests-title">Huy hiệu</div>
              <div className="muted small">Đã có {nBadges}/{BADGES.length}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setSheet(true)}>Xem tất cả</button>
          </div>
          <div className="badge-row" aria-hidden>
            {[...BADGES].sort((a, b) => Number(b.id in p.badges) - Number(a.id in p.badges)).slice(0, 7).map((b) => (
              <span key={b.id} className={`badge-mini ${b.id in p.badges ? 'got' : ''}`} title={b.name}>{b.icon}</span>
            ))}
          </div>
        </section>
      </main>
      {sheet && <BadgesSheet p={p} onClose={closeSheet} />}
    </>
  )
}
