import { it, expect, vi, beforeEach } from 'vitest'

const H = { impact: vi.fn(async () => {}), notification: vi.fn(async () => {}) }
let native = true
vi.mock('@capacitor/haptics', () => ({ Haptics: H, ImpactStyle: { Light: 'LIGHT' }, NotificationType: { Error: 'ERROR' } }))
vi.mock('../src/lib/platform', () => ({ isNative: () => native }))
const { buzz } = await import('../src/lib/haptics')

beforeEach(() => { vi.clearAllMocks(); native = true })

it('native: đúng rung nhẹ, sai rung báo lỗi', () => {
  buzz(true)
  expect(H.impact).toHaveBeenCalledWith({ style: 'LIGHT' })
  buzz(false)
  expect(H.notification).toHaveBeenCalledWith({ type: 'ERROR' })
})

it('web: dùng navigator.vibrate, không gọi plugin', () => {
  native = false
  const vib = vi.fn()
  Object.defineProperty(navigator, 'vibrate', { value: vib, configurable: true })
  buzz(false)
  expect(vib).toHaveBeenCalledWith([30, 40, 30])
  expect(H.impact).not.toHaveBeenCalled()
})

it('rung theo sự kiện (web): nghe 1 nhịp, gửi 2 nhịp, vui nhiều nhịp', async () => {
  native = false
  const vib = vi.fn()
  Object.defineProperty(navigator, 'vibrate', { value: vib, configurable: true })
  const h = await import('../src/lib/haptics')
  h.hapticListen(); h.hapticSend(); h.hapticWin()
  expect(vib.mock.calls.map((c) => c[0])).toEqual([[20], [12, 90, 12], [15, 50, 15, 50, 40]])
})
