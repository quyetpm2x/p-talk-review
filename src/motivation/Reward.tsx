import { useEffect, useRef, useState } from 'react'
import { celebrate } from '../lib/fx'
import { sfx } from '../lib/sfx'
import type { RewardReport } from './engine'
import { getBadge } from './badges'
import { levelInfo, levelTitle } from './xp'
import { Mascot } from './Mascot'
import '../styles/motivation.css'

export const isLevelUp = (r: RewardReport | null | undefined) => !!r && r.levelAfter > r.levelBefore

/**
 * Hiệu ứng ăn mừng một lần cho mỗi báo cáo (ref chặn StrictMode chạy effect 2 lần).
 * Pháo hoa khi có kỷ lục / lên cấp / huy hiệu mới.
 */
export function useCelebrate(report: RewardReport | null | undefined, record = false) {
  const fired = useRef<unknown>(null)
  useEffect(() => {
    const key = report ?? (record ? 'record' : null)
    if (!key || fired.current === key) return
    const big = isLevelUp(report) || !!report?.badges.length
    if (!big && !record) return
    fired.current = key
    celebrate()
    if (big) sfx('win')
  }, [report, record])
}

/** Thẻ XP trên trang kết quả: +XP bay lên, thanh XP chạy, "Lên cấp!". */
export function RewardPanel({ report }: { report: RewardReport }) {
  const before = levelInfo(report.xpBefore)
  const after = levelInfo(report.xpAfter)
  const up = isLevelUp(report)
  const [w, setW] = useState(up ? 0 : before.pct)
  useEffect(() => {
    const t = setTimeout(() => setW(after.pct), 350)
    return () => clearTimeout(t)
  }, [after.pct])
  return (
    <section className={`card xp-card ${up ? 'up' : ''}`} aria-label="Điểm kinh nghiệm">
      {up && (
        <div className="lvl-up" role="status">
          <span className="lvl-up-star" aria-hidden>⭐</span>
          <div>
            <div className="lvl-up-t">Lên cấp!</div>
            <div className="small">Cấp {report.levelAfter} · {levelTitle(report.levelAfter)}</div>
          </div>
        </div>
      )}
      <div className="xp-top">
        <span className="xp-lvl" aria-label={`Cấp ${after.level}`}>{after.level}</span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="xp-name">Cấp {after.level} · {levelTitle(after.level)}</div>
          <div className="xp-bar" role="progressbar" aria-valuenow={Math.round(after.pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến độ lên cấp">
            <div style={{ width: `${w}%` }} />
          </div>
          <div className="muted small">{after.into}/{after.need} XP để lên cấp {after.level + 1}</div>
        </div>
        <span className="xp-gain" aria-label={`Nhận ${report.gained} XP`}>
          <span className="xp-float" aria-hidden>+{report.gained}</span>
          +{report.gained}<small>XP</small>
        </span>
      </div>
      <ul className="xp-parts">
        {report.parts.map((x, i) => (
          <li key={i} className={x.label.startsWith('Nhiệm vụ') ? 'quest' : ''}>
            <span className="grow">{x.label.startsWith('Nhiệm vụ') ? '🎯 ' : ''}{x.label}</span><b>+{x.xp}</b>
          </li>
        ))}
        {report.capped && <li className="muted"><span className="grow">Đã học nhiều hôm nay — XP giảm dần, nghỉ ngơi chút nhé!</span></li>}
      </ul>
    </section>
  )
}

/** Modal chúc mừng huy hiệu mới. */
export function BadgeModal({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [onClose])
  const list = ids.map(getBadge).filter((b) => !!b)
  if (!list.length) return null
  return (
    <div className="sheet-backdrop center-modal" onClick={onClose}>
      <div className="badge-modal" role="dialog" aria-modal="true" aria-label="Huy hiệu mới" onClick={(e) => e.stopPropagation()}>
        <div className="badge-modal-rays" aria-hidden />
        <div className="label" style={{ color: '#e9dcc0' }}>{list.length > 1 ? `${list.length} huy hiệu mới!` : 'Huy hiệu mới!'}</div>
        <div className="badge-modal-list">
          {list.map((b) => (
            <div key={b.id} className="badge-modal-item">
              <span className="badge-modal-medal" aria-hidden>{b.icon}</span>
              <b>{b.name}</b>
              <span className="small" style={{ opacity: 0.8 }}>{b.desc}</span>
            </div>
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Mascot mood="dance" size={64} />
        </div>
        <button className="btn btn-primary btn-block" onClick={onClose} autoFocus>Tuyệt vời!</button>
      </div>
    </div>
  )
}

/** Dòng phần thưởng gọn cho Hội thoại / Ngữ pháp. */
export function RewardInline({ report }: { report: RewardReport | null }) {
  const [open, setOpen] = useState(true)
  useCelebrate(report)
  if (!report) return null
  return (
    <>
      <div className="reward-inline" role="status">
        <span className="tag accent">+{report.gained} XP</span>
        {isLevelUp(report) && <span className="tag accent">⭐ Lên cấp {report.levelAfter}!</span>}
        {report.quests.map((q) => <span key={q.id} className="tag">🎯 {q.title}</span>)}
      </div>
      {open && report.badges.length > 0 && <BadgeModal ids={report.badges} onClose={() => setOpen(false)} />}
    </>
  )
}
