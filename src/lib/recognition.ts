/**
 * Nhận diện giọng nói tiếng Anh.
 * - Web: Web Speech API (Chrome/Android, Safari).
 * - App iOS/Android: plugin native @capgo/capacitor-speech-recognition (WebView không có Web Speech API).
 * Cả hai trả cùng dạng: mảng phương án transcript, tốt nhất trước.
 */
import { SpeechRecognition as NativeSR } from '@capgo/capacitor-speech-recognition'
import type { PluginListenerHandle } from '@capacitor/core'
import { isNative } from './platform'

type Ctor = new () => any
const getCtor = (): Ctor | undefined =>
  typeof window === 'undefined' ? undefined : (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition

export const hasRecognition = () => isNative() || !!getCtor()

export type ListenError = 'unsupported' | 'denied' | 'no-speech' | 'network' | 'aborted'

export type ListenOpts = {
  /** Im lặng bao lâu (ms) sau khi đã có chữ thì chốt câu — app native. Mặc định NATIVE_SILENCE_MS. */
  silenceMs?: number
  /** Nhận chữ tạm trong lúc đang nói (hiện cho người học thấy) */
  onPartial?: (text: string) => void
}

/** Nghe một câu; promise trả về các phương án transcript (tốt nhất trước). */
export function listen(opts: ListenOpts = {}): { promise: Promise<string[]>; stop: () => void } {
  return isNative() ? listenNative(opts) : listenWeb(opts)
}

function listenWeb(opts: ListenOpts = {}): { promise: Promise<string[]>; stop: () => void } {
  const C = getCtor()
  if (!C) return { promise: Promise.reject<string[]>('unsupported'), stop: () => {} }
  const rec = new C()
  rec.lang = 'en-US'
  rec.interimResults = !!opts.onPartial
  rec.maxAlternatives = 3
  rec.continuous = false
  const promise = new Promise<string[]>((resolve, reject) => {
    let got: string[] | null = null
    rec.onresult = (e: any) => {
      const r = e.results[0]
      if (!r.isFinal) { opts.onPartial?.(r[0].transcript as string); return }
      got = Array.from({ length: r.length }, (_, i) => r[i].transcript as string)
    }
    rec.onerror = (e: any) => {
      const map: Record<string, ListenError> = {
        'not-allowed': 'denied', 'service-not-allowed': 'denied', 'no-speech': 'no-speech',
        network: 'network', aborted: 'aborted', 'audio-capture': 'denied',
      }
      reject(map[e.error] ?? 'network')
    }
    rec.onend = () => (got ? resolve(got) : reject('no-speech'))
  })
  promise.catch(() => {})
  try {
    rec.start()
  } catch {
    return { promise: Promise.reject<string[]>('aborted'), stop: () => {} }
  }
  return { promise, stop: () => rec.stop() }
}

/** Im lặng bao lâu (sau khi đã nghe được chữ) thì coi như nói xong và chốt kết quả. */
export const NATIVE_SILENCE_MS = 1300
/** Chưa nghe được chữ nào sau bấy lâu thì dừng. */
export const NATIVE_NO_SPEECH_MS = 8000

/** Mã lỗi của plugin native → lỗi chung của app. */
export function mapNativeError(code?: string, message?: string): ListenError {
  const s = `${code ?? ''} ${message ?? ''}`.toUpperCase()
  if (/PERMISSION|DENIED|NOT_AUTHORIZED|INSUFFICIENT_PERMISSIONS/.test(s)) return 'denied'
  if (/NETWORK|SERVER/.test(s)) return 'network'
  if (/UNSUPPORTED|UNAVAILABLE|NOT_AVAILABLE/.test(s)) return 'unsupported'
  if (/ABORT|CANCEL/.test(s)) return 'aborted'
  return 'no-speech' // NO_MATCH, SPEECH_TIMEOUT, lỗi lạ: cho người học thử lại
}

function listenNative(opts: ListenOpts = {}): { promise: Promise<string[]>; stop: () => void } {
  let latest: string[] = []
  let errorCode: string | undefined
  let silence = 0
  let settled = false
  let started = false
  let stopRequested = false
  const handles: Promise<PluginListenerHandle>[] = []
  let resolveP: (v: string[]) => void = () => {}
  let rejectP: (e: ListenError) => void = () => {}

  const cleanup = () => {
    clearTimeout(silence)
    handles.forEach((h) => h.then((x) => x.remove()).catch(() => {}))
  }
  const finish = () => {
    if (settled) return
    settled = true
    cleanup()
    const best = latest.filter((m) => m.trim())
    if (best.length) resolveP(best.slice(0, 3))
    else rejectP(errorCode ? mapNativeError(errorCode) : 'no-speech') // như web: dừng mà chưa nghe được gì
  }
  const fail = (e: ListenError) => {
    if (settled) return
    settled = true
    cleanup()
    NativeSR.stop().catch(() => {})
    rejectP(e)
  }
  const stopNow = () => {
    stopRequested = true
    clearTimeout(silence)
    if (!started) return fail('aborted')
    // iOS chỉ chốt kết quả khi bị dừng; đợi sự kiện 'stopped' rồi finish, có dự phòng nếu không tới
    NativeSR.stop().catch(() => {}).finally(() => window.setTimeout(finish, 400))
  }

  const promise = new Promise<string[]>((resolve, reject) => {
    resolveP = resolve
    rejectP = reject
  })
  promise.catch(() => {})

  ;(async () => {
    try {
      let perm = (await NativeSR.checkPermissions()).speechRecognition
      if (perm !== 'granted') perm = (await NativeSR.requestPermissions()).speechRecognition
      if (perm !== 'granted') return fail('denied')
      if (settled) return

      handles.push(
        NativeSR.addListener('partialResults', (e) => {
          const m = e.matches ?? (e.accumulatedText ? [e.accumulatedText] : [])
          if (!m.some((x) => x.trim())) return
          latest = m
          opts.onPartial?.(m[0])
          clearTimeout(silence)
          silence = window.setTimeout(stopNow, opts.silenceMs ?? NATIVE_SILENCE_MS)
        }),
        NativeSR.addListener('error', (e) => { errorCode = e.code || e.message }),
        NativeSR.addListener('listeningState', (e) => {
          if (e.state === 'stopped' || e.status === 'stopped') {
            if (e.errorCode) errorCode = e.errorCode
            finish()
          }
        }),
      )
      await Promise.all(handles)
      if (settled) return
      started = true
      // iOS không tự dừng khi không ai nói → tự dừng sau NATIVE_NO_SPEECH_MS
      silence = window.setTimeout(stopNow, NATIVE_NO_SPEECH_MS)
      await NativeSR.start({ language: 'en-US', maxResults: 3, partialResults: true, popup: false })
      if (stopRequested) NativeSR.stop().catch(() => {})
    } catch (e: any) {
      fail(mapNativeError(e?.code, e?.message ?? String(e)))
    }
  })()

  return { promise, stop: stopNow }
}
