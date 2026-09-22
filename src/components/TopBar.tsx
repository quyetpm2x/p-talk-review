import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

export function TopBar({ title, sub, back, right }: { title: ReactNode; sub?: ReactNode; back?: string | true; right?: ReactNode }) {
  const nav = useNavigate()
  return (
    <header className="topbar">
      {back && (
        <button className="icon-btn" aria-label="Quay lại" onClick={() => (back === true ? nav(-1) : nav(back, { state: { back: true } }))}>
          ←
        </button>
      )}
      <h1>
        {title}
        {sub && <small>{sub}</small>}
      </h1>
      {right}
    </header>
  )
}
