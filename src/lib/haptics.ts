export const buzz = (ok: boolean) => {
  try {
    navigator.vibrate?.(ok ? 15 : [30, 40, 30])
  } catch {
    /* không hỗ trợ rung */
  }
}
