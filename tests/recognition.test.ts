import { it, expect, vi, beforeEach, afterEach, describe } from 'vitest'

type L = (e: any) => void
const listeners: Record<string, L[]> = {}
const emit = (name: string, e: any) => (listeners[name] ?? []).forEach((f) => f(e))
let perm = 'granted'
let requestResult = 'granted'
const SR = {
  checkPermissions: vi.fn(async () => ({ speechRecognition: perm })),
  requestPermissions: vi.fn(async () => ({ speechRecognition: requestResult })),
  addListener: vi.fn(async (name: string, f: L) => {
    ;(listeners[name] ??= []).push(f)
    return { remove: async () => { listeners[name] = listeners[name].filter((x) => x !== f) } }
  }),
  start: vi.fn(async () => {}),
  stop: vi.fn(async () => { emit('listeningState', { state: 'stopped' }) }),
}
let native = true
vi.mock('@capgo/capacitor-speech-recognition', () => ({ SpeechRecognition: SR }))
vi.mock('../src/lib/platform', () => ({ isNative: () => native, platform: () => (native ? 'ios' : 'web') }))

const { listen, hasRecognition, mapNativeError, NATIVE_SILENCE_MS, NATIVE_NO_SPEECH_MS } = await import('../src/lib/recognition')
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }

beforeEach(() => {
  vi.useFakeTimers()
  for (const k of Object.keys(listeners)) delete listeners[k]
  vi.clearAllMocks()
  perm = 'granted'
  requestResult = 'granted'
  native = true
})
afterEach(() => vi.useRealTimers())

describe('native', () => {
  it('hasRecognition luôn true trong app', () => {
    expect(hasRecognition()).toBe(true)
  })

  it('chốt kết quả sau một quãng im lặng, trả tối đa 3 phương án', async () => {
    const { promise } = listen()
    await flush()
    expect(SR.start).toHaveBeenCalledWith(expect.objectContaining({ language: 'en-US', partialResults: true, popup: false }))
    emit('partialResults', { matches: ['I am'] })
    emit('partialResults', { matches: ['I am so sorry', 'I am sorry', 'I\'m so sorry', 'extra'] })
    await vi.advanceTimersByTimeAsync(NATIVE_SILENCE_MS + 10)
    await expect(promise).resolves.toEqual(['I am so sorry', 'I am sorry', 'I\'m so sorry'])
    expect(SR.stop).toHaveBeenCalled()
  })

  it('xin quyền khi chưa có; từ chối → denied, không bắt đầu nghe', async () => {
    perm = 'prompt'
    requestResult = 'denied'
    const { promise } = listen()
    await expect(promise).rejects.toBe('denied')
    expect(SR.requestPermissions).toHaveBeenCalled()
    expect(SR.start).not.toHaveBeenCalled()
  })

  it('không nói gì → tự dừng và báo no-speech', async () => {
    const { promise } = listen()
    await flush()
    await vi.advanceTimersByTimeAsync(NATIVE_NO_SPEECH_MS + 500)
    await expect(promise).rejects.toBe('no-speech')
  })

  it('bấm dừng giữa chừng vẫn trả câu đã nghe được', async () => {
    const { promise, stop } = listen()
    await flush()
    emit('partialResults', { matches: ['hang in there'] })
    stop()
    await vi.advanceTimersByTimeAsync(500)
    await expect(promise).resolves.toEqual(['hang in there'])
  })

  it('plugin báo lỗi quyền micro → denied', async () => {
    const { promise } = listen()
    await flush()
    emit('listeningState', { state: 'stopped', errorCode: 'MICROPHONE_PERMISSION_DENIED' })
    await expect(promise).rejects.toBe('denied')
  })

  it('map mã lỗi', () => {
    expect(mapNativeError('NO_MATCH')).toBe('no-speech')
    expect(mapNativeError('SPEECH_TIMEOUT')).toBe('no-speech')
    expect(mapNativeError('ERROR_NETWORK')).toBe('network')
    expect(mapNativeError(undefined, 'Missing speech recognition permission.')).toBe('denied')
    expect(mapNativeError(undefined, 'Speech recognizer is currently unavailable.')).toBe('unsupported')
  })
})

describe('web', () => {
  it('không gọi plugin; trình duyệt không hỗ trợ → unsupported', async () => {
    native = false
    expect(hasRecognition()).toBe(false)
    await expect(listen().promise).rejects.toBe('unsupported')
    expect(SR.start).not.toHaveBeenCalled()
  })
})
