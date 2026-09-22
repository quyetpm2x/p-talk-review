import { useEffect, useRef } from 'react'

export const AUTO_DELAY = { ok: 1200, bad: 2500 }

/** Thanh đếm ngược rồi tự gọi onNext; chạm vào để chuyển ngay. */
export function AutoNext({ ms, onNext, label = 'Sang câu tiếp' }: { ms: number; onNext: () => void; label?: string }) {
  const cb = useRef(onNext)
  cb.current = onNext
  const fired = useRef(false)
  const go = () => {
    if (fired.current) return
    fired.current = true
    cb.current()
  }
  useEffect(() => {
    const t = setTimeout(go, ms)
    return () => clearTimeout(t)
  }, [ms]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <button type="button" className="autonext" onClick={go} aria-label={`${label} ngay`}>
      <span className="autonext-bar" style={{ animationDuration: `${ms}ms` }} />
      <span className="autonext-label">{label} →</span>
    </button>
  )
}
