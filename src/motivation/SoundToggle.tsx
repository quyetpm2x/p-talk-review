import { useState } from 'react'
import { isMuted, setMuted, sfx } from '../lib/sfx'
import '../styles/motivation.css'

/** Nút tắt/bật âm thanh hiệu ứng toàn app (dùng chung với các trò Giải trí). */
export function SoundToggle() {
  const [muted, setM] = useState(isMuted)
  const toggle = () => {
    const m = !muted
    setMuted(m)
    setM(m)
    if (!m) sfx('ok')
  }
  return (
    <button className="hero-chip-btn" onClick={toggle} aria-pressed={!muted}
      aria-label={muted ? 'Bật âm thanh hiệu ứng' : 'Tắt âm thanh hiệu ứng'} title={muted ? 'Đang tắt âm thanh' : 'Đang bật âm thanh'}>
      <span aria-hidden>{muted ? '🔇' : '🔊'}</span>
    </button>
  )
}
