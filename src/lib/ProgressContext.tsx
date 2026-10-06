import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { loadProgress, saveProgress, type Progress } from './progress'
import { noteLocalChange, onProgressReplaced } from './sync'

type Ctx = [Progress, (fn: (p: Progress) => Progress) => void]
const ProgressCtx = createContext<Ctx | null>(null)

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [p, setP] = useState<Progress>(loadProgress)
  // Bản mới nhất (kể cả khi React chưa render lại) để update chạy tuần tự, đồng bộ
  // và chỉ một lần mỗi lời gọi (không bị StrictMode gọi hàm cập nhật 2 lần).
  const ref = useRef(p)
  const update = useCallback((fn: (p: Progress) => Progress) => {
    const cur = ref.current
    const next = fn(cur)
    if (next === cur) return
    ref.current = next
    saveProgress(next)
    setP(next)
    noteLocalChange() // đồng bộ lên máy chủ sau vài giây
  }, [])
  // Đồng bộ (đăng nhập, máy khác, đăng xuất) thay tiến độ trên máy → cập nhật màn hình
  useEffect(() => onProgressReplaced((next) => { ref.current = next; setP(next) }), [])
  return <ProgressCtx.Provider value={[p, update]}>{children}</ProgressCtx.Provider>
}

export function useProgress(): Ctx {
  const c = useContext(ProgressCtx)
  if (!c) throw new Error('useProgress phải nằm trong ProgressProvider')
  return c
}

/** Tên người học (đã nhập ở màn chào mừng). */
export const useUserName = () => useProgress()[0].name
