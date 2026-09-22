import { useEffect } from 'react'
import type { Progress } from '../lib/progress'
import { BADGES } from './badges'
import '../styles/motivation.css'

/** Sheet trượt từ dưới lên: xem tất cả huy hiệu (đã có / chưa có). */
export function BadgesSheet({ p, onClose }: { p: Progress; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  const got = BADGES.filter((b) => b.id in p.badges).length
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Huy hiệu" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden />
        <div className="row">
          <div className="grow">
            <div className="sheet-title">🏅 Huy hiệu</div>
            <div className="muted small">Đã có {got}/{BADGES.length}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} autoFocus>Đóng</button>
        </div>
        <ul className="badge-grid">
          {BADGES.map((b) => {
            const at = p.badges[b.id]
            return (
              <li key={b.id} className={`badge ${at ? 'got' : 'locked'}`}>
                <span className="badge-medal" aria-hidden>{b.icon}{!at && <i className="badge-lock">🔒</i>}</span>
                <b>{b.name}</b>
                <span className="badge-desc">{b.desc}</span>
                <span className="mv-sr">{at ? 'Đã đạt' : 'Chưa đạt'}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
