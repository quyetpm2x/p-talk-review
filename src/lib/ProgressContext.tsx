import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { loadProgress, saveProgress, type Progress } from './progress'

type Ctx = [Progress, (fn: (p: Progress) => Progress) => void]
const ProgressCtx = createContext<Ctx | null>(null)

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [p, setP] = useState<Progress>(loadProgress)
  const update = useCallback((fn: (p: Progress) => Progress) => {
    setP((cur) => {
      const next = fn(cur)
      if (next !== cur) saveProgress(next)
      return next
    })
  }, [])
  return <ProgressCtx.Provider value={[p, update]}>{children}</ProgressCtx.Provider>
}

export function useProgress(): Ctx {
  const c = useContext(ProgressCtx)
  if (!c) throw new Error('useProgress phải nằm trong ProgressProvider')
  return c
}
