import { useEffect, useState } from 'react'

export const prefersReducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Hiện dần chữ như đang gõ. Đổi `text` là gõ lại từ đầu.
 * Trả về số ký tự đang hiện, đã gõ xong chưa, và hàm hiện hết ngay (chạm để bỏ qua).
 */
export function useTypewriter(text: string, msPerChar = 28) {
  const [n, setN] = useState(() => (prefersReducedMotion() ? text.length : 0))
  const [src, setSrc] = useState(text)
  // Đổi câu → gõ lại (đặt lại ngay trong render để khỏi nháy câu cũ)
  if (src !== text) {
    setSrc(text)
    setN(prefersReducedMotion() ? text.length : 0)
  }
  useEffect(() => {
    if (n >= text.length) return
    const t = setTimeout(() => setN((x) => Math.min(text.length, x + 1)), msPerChar)
    return () => clearTimeout(t)
  }, [n, text, msPerChar])
  const shown = src === text ? n : 0
  return { shown: text.slice(0, shown), done: shown >= text.length, skip: () => setN(text.length) }
}
