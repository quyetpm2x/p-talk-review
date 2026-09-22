import confetti from 'canvas-confetti'

const GOLD = ['#f3dc9f', '#d4ad5e', '#c9a04e', '#a97d35', '#ffffff', '#13203f']
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Nổ hoa giấy nhỏ tại toạ độ màn hình (px). */
export function burst(x: number, y: number, count = 24) {
  if (reduced()) return
  confetti({
    particleCount: count, spread: 70, startVelocity: 26, ticks: 60, scalar: 0.8, gravity: 1.1,
    origin: { x: x / innerWidth, y: y / innerHeight }, colors: GOLD, disableForReducedMotion: true,
  })
}

/** Pháo hoa giấy lớn khi thắng / lập kỷ lục. */
export function celebrate() {
  if (reduced()) return
  const end = Date.now() + 900
  ;(function frame() {
    confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: GOLD })
    confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: GOLD })
    if (Date.now() < end) requestAnimationFrame(frame)
  })()
}
