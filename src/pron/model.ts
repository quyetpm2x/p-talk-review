/**
 * Mô hình chấm phát âm (wav2vec2 Meta, bản int8 — Apache-2.0): tải MỘT LẦN sau khi học sinh bật tính năng, lưu trên máy.
 * - Web: Cache Storage.  - App iOS/Android: thư mục dữ liệu của app (Filesystem.downloadFile — tải native, không qua bộ nhớ JS).
 * Không nằm trong gói app trên store (355MB).
 */
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { isNative } from '../lib/platform'

export const MODEL_URL = 'https://huggingface.co/duyentq/sonari-wav2vec2-phoneme-int8/resolve/main/wav2vec2_int8.onnx'
export const MODEL_BYTES = 355_352_992
const CACHE = 'ptalk-pron-model-v1'
const PATH = 'models/wav2vec2_int8.onnx'

export async function isModelReady(): Promise<boolean> {
  try {
    if (isNative()) {
      const st = await Filesystem.stat({ path: PATH, directory: Directory.Data })
      return Number(st.size) === MODEL_BYTES
    }
    const r = await (await caches.open(CACHE)).match(MODEL_URL)
    return Number(r?.headers.get('content-length') ?? 0) === MODEL_BYTES
  } catch {
    return false
  }
}

/** Tải mô hình, báo tiến độ 0–1. */
export async function downloadModel(onProgress: (f: number) => void, signal?: AbortSignal): Promise<void> {
  if (isNative()) {
    const h = await Filesystem.addListener('progress', (p) => onProgress(p.bytes / (p.contentLength || MODEL_BYTES)))
    try {
      await Filesystem.mkdir({ path: 'models', directory: Directory.Data, recursive: true }).catch(() => {})
      await Filesystem.downloadFile({ url: MODEL_URL, path: PATH, directory: Directory.Data, progress: true })
      if (!(await isModelReady())) throw new Error('Tải mô hình chưa trọn vẹn, thử lại nhé')
    } finally {
      await h.remove()
    }
    return
  }
  const res = await fetch(MODEL_URL, { signal })
  if (!res.ok || !res.body) throw new Error('Không tải được mô hình, kiểm tra mạng rồi thử lại')
  const total = Number(res.headers.get('content-length')) || MODEL_BYTES
  let got = 0
  // Chảy thẳng vào Cache Storage (không giữ 355MB trong bộ nhớ JS), đếm byte để báo tiến độ
  const counted = res.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctl) { got += chunk.length; onProgress(got / total); ctl.enqueue(chunk) },
  }))
  const c = await caches.open(CACHE)
  await c.put(MODEL_URL, new Response(counted, { headers: { 'content-length': String(total), 'content-type': 'application/octet-stream' } }))
  if (got !== MODEL_BYTES) { await c.delete(MODEL_URL); throw new Error('Tải mô hình chưa trọn vẹn, thử lại nhé') }
}

/** Nơi luồng nền tự đọc mô hình (tránh chuyển 355MB qua luồng giao diện). */
export async function modelSource(): Promise<{ kind: 'cache'; cache: string; url: string } | { kind: 'url'; url: string }> {
  if (isNative()) {
    const { uri } = await Filesystem.getUri({ path: PATH, directory: Directory.Data })
    return { kind: 'url', url: Capacitor.convertFileSrc(uri) }
  }
  return { kind: 'cache', cache: CACHE, url: MODEL_URL }
}

export async function deleteModel() {
  if (isNative()) await Filesystem.deleteFile({ path: PATH, directory: Directory.Data }).catch(() => {})
  else await caches.delete(CACHE)
}
