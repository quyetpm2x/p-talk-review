import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getLesson } from '../lessons'
import { GAMES } from '../games/registry'
import { TIERS } from '../games/types'
import { phrasePool } from '../lib/picker'
import { useProgress } from '../lib/ProgressContext'
import { UserName } from '../components/UserName'
import { lessonPercent, statKey } from '../lib/progress'
import { isDue } from '../lib/leitner'
import { ProgressBar } from '../components/ProgressBar'
import { SpeakButton } from '../components/SpeakButton'
import { useState } from 'react'

export function PhrasesPage() {
  const { id = '' } = useParams()
  const lesson = getLesson(id)!
  const [sp, setSp] = useSearchParams()
  const set = sp.get('set') ?? 'all'
  const [p] = useProgress()
  const [showList, setShowList] = useState(false)
  const now = Date.now()
  const all = phrasePool(lesson, set)
  const due = all.filter((i) => isDue(p.phrases[statKey(lesson.id, i.id)], now)).length
  const pct = lessonPercent(p, lesson)
  const sets = [
    { id: 'all', label: 'Tất cả' },
    ...[...lesson.groups].sort((a, b) => a.order - b.order).map((g) => ({ id: g.id, label: `${g.icon} ${g.vi}` })),
    { id: 'extra', label: '✨ Cụm gợi ý thêm' },
  ]

  return (
    <>
      <div className="card stack" style={{ gap: 10 }}>
        <div className="row">
          <div className="grow">
            <div className="label">Kho cụm từ</div>
            <div style={{ fontWeight: 700 }}>{p.name ? <><UserName /> đã nhớ</> : 'Đã nhớ'} {Math.round(pct)}% · {due} cụm cần ôn</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowList((s) => !s)} aria-expanded={showList}>
            {showList ? 'Ẩn' : 'Xem cụm'}
          </button>
        </div>
        <ProgressBar value={pct} />
      </div>

      <div className="set-scroll" role="tablist" aria-label="Chọn bộ cụm">
        {sets.map((s) => (
          <button key={s.id} role="tab" aria-selected={set === s.id} className={`set-chip ${set === s.id ? 'on' : ''}`}
            onClick={() => setSp(s.id === 'all' ? {} : { set: s.id }, { replace: true })}>
            {s.label}
          </button>
        ))}
      </div>

      {showList && (
        <div className="card stack" style={{ gap: 0, padding: 0 }}>
          {all.map((i, k) => {
            const box = p.phrases[statKey(lesson.id, i.id)]?.box ?? 0
            return (
              <div key={i.id} className="row" style={{ padding: '10px 14px', borderTop: k ? '1px solid var(--line)' : 0 }}>
                <div className="grow">
                  <div lang="en" style={{ fontWeight: 600 }}>{i.en}</div>
                  <div className="muted small">{i.vi}{i.synonym && <> · <span lang="en">≈ {i.synonym}</span></>}</div>
                </div>
                <span className="box-dots" aria-label={`Mức nhớ ${box}/5`}>
                  {[1, 2, 3, 4, 5].map((d) => <i key={d} className={d <= box ? 'on' : ''} />)}
                </span>
                <SpeakButton text={i.en} />
              </div>
            )
          })}
        </div>
      )}

      {TIERS.filter((t) => GAMES.some((g) => g.tier === t.id)).map((t) => (
        <section key={t.id} className="stack">
          <div className="section-bar">{t.name} <em>— {t.desc}</em></div>
          <div className="game-grid">
            {GAMES.filter((g) => g.tier === t.id).map((g) => {
              const n = GAMES.indexOf(g) + 1
              const lock = g.lockReason(all.filter(g.eligible), set, lesson)
              const best = p.bestScores[`${lesson.id}:${g.id}`]
              return (
                <Link key={g.id} to={`/lesson/${lesson.id}/phrases/${g.id}${set !== 'all' ? `?set=${set}` : ''}`}
                  className={`game-tile ${lock ? 'locked' : ''}`} aria-disabled={!!lock}
                  onClick={(e) => lock && e.preventDefault()}>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <span className="game-icon" aria-hidden>{g.icon}</span>
                    <span className="grow" />
                    <span className="game-no">{lock ? '🔒' : n}</span>
                  </div>
                  <div className="game-name">{g.name}</div>
                  <div className="game-desc">{lock ?? g.desc}</div>
                  {best !== undefined && !lock && <div className="tag accent">⭐ {best}</div>}
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </>
  )
}
