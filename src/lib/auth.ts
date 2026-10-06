/**
 * Phiên đăng nhập trên máy này: token + thông tin tài khoản.
 * Lưu qua lớp storage (app iOS/Android sao lưu sang bộ lưu native) để không bị đăng xuất bất ngờ.
 */
import { useSyncExternalStore } from 'react'
import type { User } from './api'
import * as storage from './storage'

export const AUTH_KEY = 'ptalk:auth'
export type Session = { token: string; user: User }

const listeners = new Set<() => void>()
let cache: Session | null | undefined

function read(): Session | null {
  try {
    const s = JSON.parse(storage.getItem(AUTH_KEY) ?? 'null')
    return s && typeof s.token === 'string' && s.user?.username ? (s as Session) : null
  } catch {
    return null
  }
}

export function getSession(): Session | null {
  if (cache === undefined) cache = read()
  return cache
}

export function setSession(s: Session | null) {
  cache = s
  if (s) storage.setItem(AUTH_KEY, JSON.stringify(s))
  else storage.removeItem(AUTH_KEY)
  listeners.forEach((f) => f())
}

/** Đọc lại từ bộ lưu (sau khi hydrate bộ lưu native lúc mở app). */
export const reloadSession = () => { cache = undefined; listeners.forEach((f) => f()) }

const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f) } }
export const useSession = () => useSyncExternalStore(subscribe, getSession, getSession)
