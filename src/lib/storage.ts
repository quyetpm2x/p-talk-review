import { Preferences } from '@capacitor/preferences'
import { isNative } from './platform'

/**
 * Lưu trữ khoá–giá trị dùng chung web và app.
 * - Đọc/ghi đồng bộ qua localStorage như trước (nhanh, code cũ không phải đổi).
 * - Trong app iOS/Android: mỗi lần ghi khoá `ptalk:*` thì sao lưu thêm sang Preferences (bộ lưu
 *   native bền) — WebView iOS có thể bị hệ điều hành xoá localStorage khi máy thiếu bộ nhớ.
 * - Khi mở app, `hydrateStorage()` chép ngược từ Preferences về localStorage (khôi phục),
 *   hoặc lần đầu thì chuyển dữ liệu localStorage sẵn có sang Preferences.
 */
const PREFIX = 'ptalk:'
const ls = (): Storage | undefined => {
  try { return typeof localStorage === 'undefined' ? undefined : localStorage } catch { return undefined }
}
const backup = (key: string, value: string | null) => {
  if (!isNative() || !key.startsWith(PREFIX)) return
  const p = value === null ? Preferences.remove({ key }) : Preferences.set({ key, value })
  p.catch(() => { /* không sao lưu được: lần ghi sau sẽ thử lại */ })
}

export function getItem(key: string): string | null {
  try { return ls()?.getItem(key) ?? null } catch { return null }
}

export function setItem(key: string, value: string) {
  try { ls()?.setItem(key, value) } catch { /* bộ nhớ đầy / bị chặn */ }
  backup(key, value)
}

export function removeItem(key: string) {
  try { ls()?.removeItem(key) } catch { /* bị chặn */ }
  backup(key, null)
}

/** Gọi một lần trước khi render app. Trên web không làm gì. */
export async function hydrateStorage(): Promise<void> {
  if (!isNative()) return
  const store = ls()
  if (!store) return
  try {
    const { keys } = await Preferences.keys()
    const saved = keys.filter((k) => k.startsWith(PREFIX))
    if (saved.length) {
      // Khôi phục: Preferences là bản gốc
      for (const key of saved) {
        const { value } = await Preferences.get({ key })
        if (value !== null) store.setItem(key, value)
      }
      return
    }
    // Lần đầu: chuyển dữ liệu sẵn có trong WebView sang Preferences
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      if (!key?.startsWith(PREFIX)) continue
      const value = store.getItem(key)
      if (value !== null) await Preferences.set({ key, value })
    }
  } catch {
    /* lỗi bộ lưu native: app vẫn chạy với localStorage */
  }
}
