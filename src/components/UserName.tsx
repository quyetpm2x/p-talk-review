import { useUserName } from '../lib/ProgressContext'

/** Tên người học, luôn được tô nổi bật. Chưa có tên thì hiện `fallback` (chữ thường). */
export function UserName({ name, fallback = 'bạn' }: { name?: string; fallback?: string }) {
  const stored = useUserName()
  const n = name ?? stored
  return n ? <b className="uname">{n}</b> : <>{fallback}</>
}
