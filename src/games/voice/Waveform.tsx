import { useEffect, useRef } from 'react'

const BARS = 21

const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Sóng âm giả lập: các thanh dọc nhảy theo nhịp khi đang phát / đang nghe.
 * Không dùng AnalyserNode vì nối thẻ audio vào AudioContext sẽ làm đổi cách phát của speak() trên iOS.
 * `speaking`: đang ở giữa một từ (thanh cao) hay khoảng lặng giữa các từ (thanh thấp).
 */
export function Waveform({ mode, speaking }: { mode: 'idle' | 'play' | 'listen'; speaking: boolean }) {
  const refs = useRef<(HTMLSpanElement | null)[]>([])
  const speakingRef = useRef(speaking)
  speakingRef.current = speaking

  useEffect(() => {
    const set = (h: (i: number) => number) =>
      refs.current.forEach((el, i) => { if (el) el.style.transform = `scaleY(${h(i).toFixed(3)})` })
    // Hình tĩnh dạng vòm khi không chạy / giảm chuyển động
    const rest = (i: number) => 0.14 + 0.1 * Math.sin((i / (BARS - 1)) * Math.PI)
    if (mode === 'idle' || reducedMotion()) {
      set(mode === 'idle' ? rest : (i) => 0.3 + 0.35 * Math.sin((i / (BARS - 1)) * Math.PI))
      return
    }
    let raf = 0
    let env = 0.3
    const loop = (t: number) => {
      // biên độ tiến dần về đích để chuyển giữa từ ↔ khoảng lặng mượt hơn
      const target = mode === 'listen' ? 0.75 : speakingRef.current ? 1 : 0.3
      env += (target - env) * 0.15
      set((i) => {
        const mid = 1 - Math.abs(i - (BARS - 1) / 2) / BARS // giữa cao hơn hai bên
        const wob = Math.abs(Math.sin(t / (110 + (i % 5) * 23) + i * 1.7)) * 0.6 + Math.abs(Math.sin(t / 67 + i)) * 0.4
        return Math.max(0.1, Math.min(1, 0.12 + env * mid * wob))
      })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [mode])

  return (
    <div className={`wave ${mode}`} aria-hidden>
      {Array.from({ length: BARS }, (_, i) => (
        <span key={i} ref={(el) => { refs.current[i] = el }} />
      ))}
    </div>
  )
}
