import { NavLink } from 'react-router-dom'

export function TabBar({ lessonId }: { lessonId: string }) {
  const tabs = [
    { to: 'phrases', icon: '📚', label: 'Cụm từ' },
    { to: 'roleplay', icon: '🎭', label: 'Role-play' },
    { to: 'grammar', icon: '📝', label: 'Ngữ pháp' },
  ]
  return (
    <nav className="tabbar" aria-label="Các phần của bài">
      {tabs.map((t) => (
        <NavLink key={t.to} to={`/lesson/${lessonId}/${t.to}`} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span aria-hidden>{t.icon}</span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
