import { useEffect, useRef } from 'react'

export const AUTO_DELAY = { ok: 1200, bad: 2500 }

/** Thanh đếm ngược rồi tự gọi onNext; khoá bấm cho tới khi chạy hết. */
export function AutoNext({ ms, onNext, label = 'Sang câu tiếp' }: { ms: number; onNext: () => void; label?: string }) {
  const cb = useRef(onNext)
  cb.current = onNext
  useEffect(() => {
    const t = setTimeout(() => cb.current(), ms)
    return () => clearTimeout(t)
  }, [ms])
  return (
    <button type="button" className="autonext" disabled aria-label={`Tự ${label.toLowerCase()}`}>
      <span className="autonext-bar" style={{ animationDuration: `${ms}ms` }} />
      <span className="autonext-label">{label} →</span>
    </button>
  )
}
