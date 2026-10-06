/**
 * Đồng bộ tiến độ với máy chủ (offline-first).
 * - App vẫn đọc/ghi tiến độ trên máy như trước; mỗi lần thay đổi → đánh dấu "chưa đồng bộ", chờ 3 giây yên rồi đẩy lên.
 * - Máy chủ giữ số phiên bản `rev`. Máy khác đã ghi bản mới hơn → máy chủ trả 409 kèm bản đó → gộp (mergeProgress) rồi gửi lại.
 * - Mất mạng: giữ dấu, thử lại khi có mạng / khi quay lại app.
 */
import { useSyncExternalStore } from 'react'
import { apiGetProgress, apiPutProgress, ApiError, type AuthResult } from './api'
import { getSession, setSession } from './auth'
import { mergeProgress } from './merge'
import { emptyProgress, KEY as PROGRESS_KEY, loadProgress, normalizeProgress, saveProgress, type Progress } from './progress'
import * as storage from './storage'

export const SYNC_KEY = 'ptalk:sync'
export const PUSH_DELAY_MS = 3000

/** rev: phiên bản máy chủ mà bản trên máy dựa vào; dirty: có thay đổi chưa đẩy; owner: tài khoản sở hữu dữ liệu trên máy. */
type SyncState = { rev: number; dirty: boolean; owner: string }
export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'offline' | 'signed-out'

function readState(): SyncState {
  try {
    const s = JSON.parse(storage.getItem(SYNC_KEY) ?? 'null')
    if (s && typeof s.rev === 'number') return { rev: s.rev, dirty: !!s.dirty, owner: String(s.owner ?? '') }
  } catch { /* hỏng → mặc định */ }
  return { rev: 0, dirty: false, owner: '' }
}
let state = readState()
const saveState = () => storage.setItem(SYNC_KEY, JSON.stringify(state))

/** So nội dung 2 bản tiến độ, không phụ thuộc thứ tự khoá. */
const stable = (x: unknown): string =>
  Array.isArray(x) ? `[${x.map(stable).join(',')}]`
    : x && typeof x === 'object' ? `{${Object.keys(x).sort().map((k) => `${JSON.stringify(k)}:${stable((x as any)[k])}`).join(',')}}`
      : JSON.stringify(x)
const same = (a: unknown, b: unknown) => stable(a) === stable(b)

// ---------- Thông báo cho giao diện ----------
const replacedListeners = new Set<(p: Progress) => void>()
/** ProgressProvider nghe để cập nhật màn hình khi đồng bộ thay tiến độ trên máy. */
export const onProgressReplaced = (f: (p: Progress) => void) => { replacedListeners.add(f); return () => { replacedListeners.delete(f) } }
const replaceLocal = (p: Progress) => { saveProgress(p); replacedListeners.forEach((f) => f(p)) }

let status: SyncStatus = getSession() ? (state.dirty ? 'pending' : 'synced') : 'signed-out'
const statusListeners = new Set<() => void>()
const setStatus = (s: SyncStatus) => { if (s !== status) { status = s; statusListeners.forEach((f) => f()) } }
export const getSyncStatus = () => status
export const useSyncStatus = () =>
  useSyncExternalStore((f) => { statusListeners.add(f); return () => { statusListeners.delete(f) } }, getSyncStatus, getSyncStatus)

// ---------- Đẩy / tải ----------
let timer: ReturnType<typeof setTimeout> | undefined
let version = 0 // tăng mỗi lần tiến độ trên máy thay đổi — biết có thay đổi mới trong lúc đang gửi
let running: Promise<boolean> | null = null

/** Gọi sau mỗi lần app lưu tiến độ (ProgressProvider). */
export function noteLocalChange() {
  if (!getSession()) return
  version++
  if (!state.dirty) { state.dirty = true; saveState() }
  setStatus('pending')
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), PUSH_DELAY_MS)
}

/** Gộp bản máy chủ vào bản trên máy; còn khác máy chủ thì đánh dấu cần đẩy. */
function absorb(server: { data: unknown; rev: number }, name: string) {
  const local = loadProgress()
  const merged = mergeProgress(local, server.data ?? {}, name)
  if (!same(merged, local)) replaceLocal(merged)
  state.rev = server.rev
  state.dirty = state.dirty || !same(merged, normalizeProgress(server.data ?? {}))
  saveState()
}

/** Đồng bộ ngay: có thay đổi thì đẩy (xung đột thì gộp rồi đẩy lại), không thì tải bản mới từ máy khác. */
export function syncNow(): Promise<boolean> {
  const s = getSession()
  if (!s) return Promise.resolve(false)
  if (running) return running
  clearTimeout(timer)
  running = (async () => {
    setStatus('syncing')
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        if (!state.dirty) {
          const srv = await apiGetProgress(s.token)
          if (srv.rev !== state.rev) absorb(srv, s.user.name)
          if (!state.dirty) { setStatus('synced'); return true }
          continue
        }
        const v = version
        try {
          const r = await apiPutProgress(s.token, loadProgress(), state.rev)
          state.rev = r.rev
          if (version === v) state.dirty = false
          saveState()
          if (!state.dirty) { setStatus('synced'); return true }
        } catch (e) {
          if (e instanceof ApiError && e.status === 409) { absorb(e.body ?? { data: null, rev: 0 }, s.user.name); continue }
          throw e
        }
      }
      setStatus('pending')
      return false
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        // Phiên hết hạn: giữ nguyên dữ liệu và dấu "chưa đồng bộ", đăng nhập lại sẽ đẩy tiếp
        setSession(null)
        setStatus('signed-out')
      } else {
        setStatus(e instanceof ApiError && e.status === 0 ? 'offline' : 'pending')
      }
      return false
    } finally {
      running = null
    }
  })()
  return running
}

// ---------- Đăng nhập / đăng xuất ----------
/**
 * Sau khi đăng ký/đăng nhập thành công: tải tiến độ trên máy chủ, gộp với dữ liệu trên máy
 * (dữ liệu cũ chưa thuộc tài khoản nào hoặc của chính tài khoản này), rồi mới vào app.
 * Dữ liệu của tài khoản khác còn sót trên máy thì bỏ.
 */
export async function signIn(r: AuthResult) {
  const local = loadProgress()
  const mine = !state.owner || state.owner === r.user.username
  const base = mine ? local : emptyProgress() // dữ liệu của tài khoản khác còn sót trên máy thì bỏ
  const srv = await apiGetProgress(r.token)
  const merged = mergeProgress(base, srv.data ?? {}, r.user.name)
  replaceLocal(merged)
  // Còn khác bản máy chủ (máy này có dữ liệu cũ, hoặc tài khoản mới chưa có bản nào) → đẩy lên
  state = { rev: srv.rev, owner: r.user.username, dirty: srv.data == null || !same(merged, normalizeProgress(srv.data)) }
  saveState()
  setSession(r)
  setStatus(state.dirty ? 'pending' : 'synced')
  if (state.dirty) void syncNow()
}

/** Đăng xuất: đẩy nốt thay đổi. Trả 'unsynced' nếu không đẩy được (mất mạng) — giao diện hỏi lại rồi gọi finishSignOut. */
export async function signOut(): Promise<'ok' | 'unsynced'> {
  if (state.dirty && !(await syncNow())) return 'unsynced'
  finishSignOut()
  return 'ok'
}

/** Xoá phiên và tiến độ trên máy (người sau dùng máy không thấy dữ liệu cũ). */
export function finishSignOut() {
  clearTimeout(timer)
  setSession(null)
  storage.removeItem(PROGRESS_KEY)
  state = { rev: 0, dirty: false, owner: '' }
  saveState()
  replacedListeners.forEach((f) => f(emptyProgress()))
  setStatus('signed-out')
}

/** Gọi một lần khi mở app: đồng bộ ngay, và mỗi khi có mạng lại / quay lại app. */
export function initSync() {
  if (typeof window === 'undefined') return
  window.addEventListener('online', () => void syncNow())
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void syncNow() })
  if (getSession()) void syncNow()
}

/** Đọc lại trạng thái từ bộ lưu — gọi sau khi khôi phục bộ lưu native lúc mở app (và trong test). */
export const reloadSyncState = () => {
  clearTimeout(timer); running = null; version = 0; state = readState()
  status = getSession() ? (state.dirty ? 'pending' : 'synced') : 'signed-out'
  statusListeners.forEach((f) => f())
}
export const __resetForTest = reloadSyncState
