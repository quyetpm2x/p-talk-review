import { NavLink } from 'react-router-dom'
import { FEATURES } from '../lib/features'

/** Thanh tab dưới cùng của bài: Cụm từ · Luyện nói (giữa, nổi bật) · Role-play (· Ngữ pháp khi bật). */
export function TabBar({ lessonId }: { lessonId: string }) {
  const tabs = [
    { to: `/lesson/${lessonId}/phrases`, icon: '📚', label: 'Cụm từ' },
    { to: `/talk/${lessonId}`, icon: '🦉', label: 'Luyện nói', main: true },
    { to: `/lesson/${lessonId}/roleplay`, icon: '🎭', label: 'Role-play' },
    ...(FEATURES.grammar ? [{ to: `/lesson/${lessonId}/grammar`, icon: '📝', label: 'Ngữ pháp' }] : []),
  ]
  return (
    <nav className="tabbar" aria-label="Các phần của bài" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} className={({ isActive }) => `${isActive ? 'active' : ''} ${'main' in t ? 'tab-main' : ''}`}>
          <span aria-hidden>{t.icon}</span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
