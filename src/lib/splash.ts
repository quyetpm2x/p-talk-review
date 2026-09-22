/**
 * Màn splash (markup + CSS nằm trong index.html để hiện ngay khi mở).
 * Giữ tối thiểu SPLASH_MS kể từ lúc mở trang rồi mờ dần; chạm để bỏ qua.
 */
const SPLASH_MS = 2200
const SPLASH_MS_REDUCED = 500

export function hideSplashWhenReady() {
  const el = document.getElementById('splash')
  if (!el) return
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  let done = false
  const hide = () => {
    if (done) return
    done = true
    el.classList.add('hide')
    setTimeout(() => el.remove(), 500)
  }
  el.addEventListener('click', hide, { once: true })
  setTimeout(hide, Math.max(0, (reduced ? SPLASH_MS_REDUCED : SPLASH_MS) - performance.now()))
}
