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
