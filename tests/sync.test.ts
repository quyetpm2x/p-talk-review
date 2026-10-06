import { it, expect, vi, beforeEach, afterEach, describe } from 'vitest'
import { emptyProgress, KEY as PROGRESS_KEY, type Progress } from '../src/lib/progress'

vi.stubEnv('VITE_API_URL', 'http://api.test')

// ---- Máy chủ giả: đúng cơ chế rev / 409 của PTalk-be ----
const srv = { data: null as any, rev: 0, puts: 0 }
let offline = false
let expired = false
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
  if (offline) throw new TypeError('Failed to fetch')
  if (expired) return json(401, { error: 'Phiên đăng nhập đã hết hạn' })
  const path = url.replace('http://api.test', '')
  if (path === '/progress' && (init.method ?? 'GET') === 'GET') return json(200, { data: srv.data, rev: srv.rev })
  if (path === '/progress' && init.method === 'PUT') {
    const b = JSON.parse(String(init.body))
    if (b.baseRev !== srv.rev) return json(409, { error: 'Có bản mới hơn', data: srv.data, rev: srv.rev })
    srv.data = b.data; srv.rev++; srv.puts++
    return json(200, { rev: srv.rev })
  }
  return json(404, {})
}))

const sync = await import('../src/lib/sync')
const auth = await import('../src/lib/auth')
const login = (username = 'an') => ({ token: 't-' + username, user: { username, name: username === 'an' ? 'An' : 'Bình', classCode: 'L2' } })
const local = (): Progress => JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? 'null') ?? emptyProgress()
const setLocal = (p: Partial<Progress>) => localStorage.setItem(PROGRESS_KEY, JSON.stringify({ ...emptyProgress(), ...p }))
const ph = (box: number, last: number) => ({ box, last, seen: 1, wrong: 0 })
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }

beforeEach(() => {
  localStorage.clear()
  Object.assign(srv, { data: null, rev: 0, puts: 0 })
  offline = false
  expired = false
  auth.setSession(null)
  sync.__resetForTest()
})
afterEach(() => vi.useRealTimers())

describe('đăng nhập', () => {
  it('tài khoản mới: dữ liệu cũ trên máy (chưa thuộc ai) được đưa lên tài khoản', async () => {
    setLocal({ name: 'Bé Na', xp: 300, phrases: { a: ph(3, 10) } })
    await sync.signIn(login())
    await flush()
    expect(auth.getSession()?.user.username).toBe('an')
    expect(local()).toMatchObject({ name: 'An', xp: 300 })
    expect(srv.data).toMatchObject({ name: 'An', xp: 300, phrases: { a: ph(3, 10) } })
  })

  it('máy mới: tải đầy đủ tiến độ từ máy chủ', async () => {
    Object.assign(srv, { data: { ...emptyProgress(), name: 'An', xp: 500, badges: { b1: 1 } }, rev: 4 })
    await sync.signIn(login())
    await flush()
    expect(local()).toMatchObject({ xp: 500, badges: { b1: 1 } })
    expect(srv.puts).toBe(0) // không có gì mới để đẩy
    expect(sync.getSyncStatus()).toBe('synced')
  })

  it('dữ liệu của tài khoản khác còn sót trên máy thì không bị gộp vào', async () => {
    await sync.signIn(login('binh'))
    sync.finishSignOut()
    setLocal({ xp: 999 }) // giả sử còn sót (vd. ghi sau khi đăng xuất)
    localStorage.setItem(sync.SYNC_KEY, JSON.stringify({ rev: 0, dirty: false, owner: 'binh' }))
    sync.__resetForTest()
    Object.assign(srv, { data: { ...emptyProgress(), name: 'An', xp: 10 }, rev: 1 })
    await sync.signIn(login('an'))
    expect(local().xp).toBe(10)
  })
})

describe('đẩy lên', () => {
  beforeEach(async () => { await sync.signIn(login()); await flush() })

  it('chờ 3 giây yên rồi mới đẩy, gom nhiều thay đổi làm một', async () => {
    vi.useFakeTimers()
    const before = srv.puts
    setLocal({ xp: 10 }); sync.noteLocalChange()
    await vi.advanceTimersByTimeAsync(1000)
    setLocal({ xp: 20 }); sync.noteLocalChange()
    expect(sync.getSyncStatus()).toBe('pending')
    await vi.advanceTimersByTimeAsync(sync.PUSH_DELAY_MS + 100)
    expect(srv.puts).toBe(before + 1)
    expect(srv.data.xp).toBe(20)
    expect(sync.getSyncStatus()).toBe('synced')
  })

  it('mất mạng: giữ dấu chưa đồng bộ, có mạng lại thì đẩy', async () => {
    offline = true
    setLocal({ xp: 77 }); sync.noteLocalChange()
    expect(await sync.syncNow()).toBe(false)
    expect(sync.getSyncStatus()).toBe('offline')
    offline = false
    expect(await sync.syncNow()).toBe(true)
    expect(srv.data.xp).toBe(77)
  })

  it('máy khác vừa đồng bộ (409) → gộp cả hai rồi gửi lại, không mất bên nào', async () => {
    // máy khác đã đẩy: học cụm b, XP 200
    srv.data = { ...srv.data, xp: 200, phrases: { b: ph(2, 50) } }; srv.rev++
    // máy này: học cụm a, XP 120
    setLocal({ name: 'An', xp: 120, phrases: { a: ph(4, 60) } }); sync.noteLocalChange()
    expect(await sync.syncNow()).toBe(true)
    expect(srv.data.phrases).toEqual({ a: ph(4, 60), b: ph(2, 50) })
    expect(srv.data.xp).toBe(200)
    expect(local().phrases).toEqual(srv.data.phrases)
  })

  it('không có thay đổi: tải bản mới do máy khác đẩy và cập nhật màn hình', async () => {
    const seen: Progress[] = []
    const off = sync.onProgressReplaced((p) => seen.push(p))
    srv.data = { ...srv.data, xp: 450 }; srv.rev++
    await sync.syncNow()
    off()
    expect(local().xp).toBe(450)
    expect(seen.at(-1)?.xp).toBe(450)
  })

  it('phiên hết hạn: về màn đăng nhập nhưng giữ dữ liệu chưa đồng bộ', async () => {
    expired = true
    setLocal({ name: 'An', xp: 66 }); sync.noteLocalChange()
    await sync.syncNow()
    expect(auth.getSession()).toBeNull()
    expect(local().xp).toBe(66)
    expired = false
    await sync.signIn(login())
    await flush()
    expect(srv.data.xp).toBe(66)
  })
})

describe('đăng xuất', () => {
  beforeEach(async () => { await sync.signIn(login()); await flush() })

  it('đẩy nốt rồi xoá dữ liệu trên máy', async () => {
    setLocal({ name: 'An', xp: 88 }); sync.noteLocalChange()
    expect(await sync.signOut()).toBe('ok')
    expect(srv.data.xp).toBe(88)
    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull()
    expect(auth.getSession()).toBeNull()
  })

  it('mất mạng có dữ liệu chưa lưu → báo, chưa đăng xuất', async () => {
    offline = true
    setLocal({ name: 'An', xp: 5 }); sync.noteLocalChange()
    expect(await sync.signOut()).toBe('unsynced')
    expect(auth.getSession()).not.toBeNull()
    expect(local().xp).toBe(5)
  })
})
