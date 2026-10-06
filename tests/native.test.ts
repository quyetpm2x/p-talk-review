import { it, expect, vi } from 'vitest'

const addListener = vi.fn()
vi.mock('@capacitor/app', () => ({ App: { addListener, exitApp: vi.fn() } }))
vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: vi.fn() } }))
vi.mock('@capacitor/status-bar', () => ({ StatusBar: { setStyle: vi.fn(), setOverlaysWebView: vi.fn() }, Style: { Dark: 'DARK' } }))
vi.mock('@capgo/capacitor-speech-recognition', () => ({ SpeechRecognition: { stop: vi.fn() } }))
const { isHomeHash, initNative } = await import('../src/lib/native')

it('nhận diện trang chủ để nút Back thoát app', () => {
  expect(isHomeHash('')).toBe(true)
  expect(isHomeHash('#/')).toBe(true)
  expect(isHomeHash('#/lesson/level2-01/phrases')).toBe(false)
})

it('web: initNative không đăng ký gì', () => {
  initNative()
  expect(addListener).not.toHaveBeenCalled()
})
