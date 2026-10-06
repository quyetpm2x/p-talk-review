import { it, expect, vi, beforeEach, describe } from 'vitest'

const prefs = new Map<string, string>()
const Preferences = {
  set: vi.fn(async ({ key, value }: { key: string; value: string }) => { prefs.set(key, value) }),
  get: vi.fn(async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null })),
  remove: vi.fn(async ({ key }: { key: string }) => { prefs.delete(key) }),
  keys: vi.fn(async () => ({ keys: [...prefs.keys()] })),
}
let native = false
vi.mock('@capacitor/preferences', () => ({ Preferences }))
vi.mock('../src/lib/platform', () => ({ isNative: () => native, platform: () => (native ? 'ios' : 'web') }))

const { getItem, setItem, removeItem, hydrateStorage } = await import('../src/lib/storage')
const { isNative } = await vi.importActual<typeof import('../src/lib/platform')>('../src/lib/platform')

beforeEach(() => {
  localStorage.clear()
  prefs.clear()
  vi.clearAllMocks()
  native = false
})

it('platform: trong jsdom không phải app native', () => {
  expect(isNative()).toBe(false)
})

describe('web', () => {
  it('đọc/ghi localStorage, không đụng Preferences', async () => {
    setItem('ptalk:x', '1')
    expect(getItem('ptalk:x')).toBe('1')
    removeItem('ptalk:x')
    expect(getItem('ptalk:x')).toBeNull()
    await hydrateStorage()
    expect(Preferences.set).not.toHaveBeenCalled()
    expect(Preferences.keys).not.toHaveBeenCalled()
  })
})

describe('native', () => {
  beforeEach(() => { native = true })

  it('ghi song song sang Preferences cho khoá ptalk:*', async () => {
    setItem('ptalk:v1:progress', '{"xp":5}')
    await Promise.resolve()
    expect(localStorage.getItem('ptalk:v1:progress')).toBe('{"xp":5}')
    expect(prefs.get('ptalk:v1:progress')).toBe('{"xp":5}')
  })

  it('không sao lưu khoá ngoài ptalk:*', async () => {
    setItem('other', '1')
    await Promise.resolve()
    expect(Preferences.set).not.toHaveBeenCalled()
  })

  it('xoá cũng xoá bên Preferences', async () => {
    prefs.set('ptalk:a', '1')
    removeItem('ptalk:a')
    await Promise.resolve()
    expect(prefs.has('ptalk:a')).toBe(false)
  })

  it('hydrate khôi phục khi WebView đã mất localStorage', async () => {
    prefs.set('ptalk:v1:progress', '{"name":"An"}')
    await hydrateStorage()
    expect(localStorage.getItem('ptalk:v1:progress')).toBe('{"name":"An"}')
  })

  it('hydrate lần đầu chuyển localStorage sẵn có sang Preferences', async () => {
    localStorage.setItem('ptalk:v1:progress', '{"name":"Bình"}')
    localStorage.setItem('khac', 'x')
    await hydrateStorage()
    expect(prefs.get('ptalk:v1:progress')).toBe('{"name":"Bình"}')
    expect(prefs.has('khac')).toBe(false)
  })
})
