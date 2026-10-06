/**
 * Mô hình chấm phát âm (wav2vec2 Meta, bản int8 — Apache-2.0, 355MB): tải MỘT LẦN khi học sinh bật tính năng, lưu trên máy.
 *
 * Tải NỀN, không phụ thuộc màn hình đang mở:
 * - App iOS: URLSession nền của hệ điều hành → vẫn tải khi tắt màn hình / chuyển sang app khác. Lưu ở Library/NoCloud (không sao lưu iCloud).
 * - App Android: DownloadManager của hệ thống → tải nền, có thanh tiến độ trên thanh thông báo.
 * - Web: fetch chảy thẳng vào Cache Storage (trình duyệt có thể tạm dừng khi tab bị ẩn).
 * Tiến độ nằm trong một kho dùng chung (`usePronDownload`) → rời màn hình rồi quay lại vẫn thấy đúng phần trăm.
 */
import { useSyncExternalStore } from 'react'
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { CapacitorDownloader } from '@capgo/capacitor-downloader'
import { isNative, platform } from '../lib/platform'
import * as storage from '../lib/storage'

export const MODEL_URL = 'https://huggingface.co/duyentq/sonari-wav2vec2-phoneme-int8/resolve/main/wav2vec2_int8.onnx'
export const MODEL_BYTES = 355_352_992
const CACHE = 'ptalk-pron-model-v1'
const PATH = 'models/wav2vec2_int8.onnx'
const TASK_ID = 'ptalk-pron-model'
const PENDING_KEY = 'ptalk:pron-download' // đang có lượt tải dở → mở lại app thì nối tiếp

/** Thư mục lưu mô hình theo nền tảng (Android: nơi DownloadManager ghi vào = external files của app). */
const dir = () => (platform() === 'android' ? Directory.External : Directory.LibraryNoCloud)

// ---------- Kho trạng thái tải dùng chung ----------
export type DlState =
  | { status: 'unknown' } | { status: 'missing' } | { status: 'ready' }
  | { status: 'downloading'; progress: number } | { status: 'error'; error: string }
let state: DlState = { status: 'unknown' }
const listeners = new Set<() => void>()
const set = (s: DlState) => { state = s; listeners.forEach((f) => f()) }
export const getDownloadState = () => state
export const usePronDownload = () =>
  useSyncExternalStore((f) => { listeners.add(f); return () => { listeners.delete(f) } }, getDownloadState, getDownloadState)

export async function isModelReady(): Promise<boolean> {
  try {
    if (isNative()) return Number((await Filesystem.stat({ path: PATH, directory: dir() })).size) === MODEL_BYTES
    const r = await (await caches.open(CACHE)).match(MODEL_URL)
    return Number(r?.headers.get('content-length') ?? 0) === MODEL_BYTES
  } catch {
    return false
  }
}

/** Gọi khi mở app và mỗi khi app quay lại từ nền: cập nhật trạng thái, nối lại lượt tải dở nếu có. */
export async function refreshDownload(): Promise<void> {
  if (await isModelReady()) { storage.removeItem(PENDING_KEY); return set({ status: 'ready' }) }
  if (state.status === 'downloading') return
  if (storage.getItem(PENDING_KEY)) return startDownload() // lượt tải trước bị gián đoạn (app bị đóng hẳn / mất mạng)
  set({ status: 'missing' })
}

let nativeHooked = false
async function hookNative() {
  if (nativeHooked) return
  nativeHooked = true
  await CapacitorDownloader.addListener('downloadProgress', (e) => {
    if (e.id !== TASK_ID) return
    const f = e.bytesTotal ? (e.bytesWritten ?? 0) / e.bytesTotal : e.progress > 1 ? e.progress / 100 : e.progress
    set({ status: 'downloading', progress: Math.max(0, Math.min(1, f)) })
  })
  await CapacitorDownloader.addListener('downloadCompleted', async (e) => {
    if (e.id !== TASK_ID) return
    if (await isModelReady()) { storage.removeItem(PENDING_KEY); set({ status: 'ready' }) }
    else fail('Tải chưa trọn vẹn, bấm tải lại nhé')
  })
  await CapacitorDownloader.addListener('downloadFailed', (e) => { if (e.id === TASK_ID) fail('Mất kết nối khi tải — bấm “Tải tiếp” khi có mạng nhé') })
}
const fail = (error: string) => { set({ status: 'error', error }) }

/** Bắt đầu (hoặc nối lại) tải. Không cần giữ màn hình — tiến độ đọc qua usePronDownload(). */
export async function startDownload(): Promise<void> {
  if (state.status === 'downloading') return
  storage.setItem(PENDING_KEY, String(Date.now()))
  set({ status: 'downloading', progress: 0 })
  try {
    if (isNative()) {
      await hookNative()
      // Nếu hệ điều hành vẫn đang tải dở từ lần trước thì chỉ cần nghe tiến độ, không tạo lượt mới
      const st = await CapacitorDownloader.checkStatus({ id: TASK_ID }).catch(() => null)
      if (st && (st.state === 'RUNNING' || st.state === 'PENDING')) return
      if (st?.state === 'PAUSED') return void (await CapacitorDownloader.resume({ id: TASK_ID }))
      await Filesystem.mkdir({ path: 'models', directory: dir(), recursive: true }).catch(() => {})
      const destination = platform() === 'android' ? PATH : (await Filesystem.getUri({ path: PATH, directory: dir() })).uri
      await CapacitorDownloader.download({ id: TASK_ID, url: MODEL_URL, destination, network: 'cellular', priority: 'high', notification: 'progress' })
      return
    }
    await downloadWeb()
    storage.removeItem(PENDING_KEY)
    set({ status: 'ready' })
  } catch (e) {
    fail((e as Error)?.message || 'Không tải được, kiểm tra mạng rồi thử lại')
  }
}

async function downloadWeb() {
  const res = await fetch(MODEL_URL)
  if (!res.ok || !res.body) throw new Error('Không tải được mô hình, kiểm tra mạng rồi thử lại')
  const total = Number(res.headers.get('content-length')) || MODEL_BYTES
  let got = 0
  // Chảy thẳng vào Cache Storage (không giữ 355MB trong bộ nhớ JS), đếm byte để báo tiến độ
  const counted = res.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctl) { got += chunk.length; set({ status: 'downloading', progress: got / total }); ctl.enqueue(chunk) },
  }))
  const c = await caches.open(CACHE)
  await c.put(MODEL_URL, new Response(counted, { headers: { 'content-length': String(total), 'content-type': 'application/octet-stream' } }))
  if (got !== MODEL_BYTES) { await c.delete(MODEL_URL); throw new Error('Tải chưa trọn vẹn, bấm tải lại nhé') }
}

/** Nơi luồng nền tự đọc mô hình (tránh chuyển 355MB qua luồng giao diện). */
export async function modelSource(): Promise<{ kind: 'cache'; cache: string; url: string } | { kind: 'url'; url: string }> {
  if (isNative()) {
    const { uri } = await Filesystem.getUri({ path: PATH, directory: dir() })
    return { kind: 'url', url: Capacitor.convertFileSrc(uri) }
  }
  return { kind: 'cache', cache: CACHE, url: MODEL_URL }
}

export async function deleteModel() {
  storage.removeItem(PENDING_KEY)
  if (isNative()) {
    await CapacitorDownloader.stop({ id: TASK_ID }).catch(() => {})
    await Filesystem.deleteFile({ path: PATH, directory: dir() }).catch(() => {})
  } else await caches.delete(CACHE)
  set({ status: 'missing' })
}
