import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { isNative } from './platform'

/** Rung phản hồi đúng/sai. App iOS/Android: rung native; web: navigator.vibrate (iPhone trên web không rung). */
export const buzz = (ok: boolean) => {
  if (isNative()) {
    const p = ok ? Haptics.impact({ style: ImpactStyle.Light }) : Haptics.notification({ type: NotificationType.Error })
    p.catch(() => { /* máy không hỗ trợ rung */ })
    return
  }
  try {
    navigator.vibrate?.(ok ? 15 : [30, 40, 30])
  } catch {
    /* không hỗ trợ rung */
  }
}

/** Rung rất nhẹ khi chạm (cảm giác bấm nút). Chỉ app native; web bỏ qua. */
export const tap = () => {
  if (isNative()) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
}

/** Những phần tử khi chạm thì rung nhẹ — nút chính, tab, lựa chọn đáp án; bỏ qua link chữ, ô nhập. */
export const HAPTIC_SELECTOR = '.btn, .tabbar a, .tb-side, .tb-send, .talk-modes button, .topic, .lg-part, .card-link, [data-haptic]' // .choice không rung ở đây: trò chơi đã rung đúng/sai

/** Gắn một lần: chạm vào phần tử khớp HAPTIC_SELECTOR → rung nhẹ. */
export function initTapHaptics() {
  if (!isNative() || typeof document === 'undefined') return
  document.addEventListener('pointerdown', (e) => {
    const el = (e.target as Element | null)?.closest?.(HAPTIC_SELECTOR)
    if (el && !(el as HTMLButtonElement).disabled) tap()
  }, { passive: true, capture: true })
}

// ---------- Rung theo sự kiện của phòng luyện nói ----------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** Mẫu rung trên web (navigator.vibrate) — app dùng Haptics native tương ứng. */
export const VIBE = { listen: [20], send: [12, 90, 12], win: [15, 50, 15, 50, 40] } as const
const webVibe = (p: readonly number[]) => { try { navigator.vibrate?.(p as number[]) } catch { /* không hỗ trợ */ } }

/** Bắt đầu nghe: một nhịp vừa. */
export const hapticListen = () => {
  if (isNative()) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {})
  else webVibe(VIBE.listen)
}
/** Gửi câu: hai nhịp nhẹ liền nhau. */
export const hapticSend = () => {
  if (!isNative()) return webVibe(VIBE.send)
  void (async () => {
    await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
    await sleep(90)
    await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
  })()
}
/** Dùng đúng cụm của bài / đạt mục tiêu buổi: rung "vui". */
export const hapticWin = () => {
  if (isNative()) Haptics.notification({ type: NotificationType.Success }).catch(() => {})
  else webVibe(VIBE.win)
}
