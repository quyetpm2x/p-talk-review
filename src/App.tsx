import { useRef } from 'react'
import { HashRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigationType, useParams } from 'react-router-dom'
import { ProgressProvider } from './lib/ProgressContext'
import { getLesson } from './lessons'
import { Home } from './pages/Home'
import { TopBar } from './components/TopBar'
import { TabBar } from './components/TabBar'
import { PhrasesPage } from './pages/PhrasesPage'
import { GamePage } from './pages/GamePage'
import { RoleplayPage } from './pages/RoleplayPage'
import { DialoguePage } from './pages/DialoguePage'
import { MissionPage } from './pages/MissionPage'
import { GrammarPage } from './pages/GrammarPage'
import './styles/tokens.css'
import './styles/base.css'

function LessonTabs() {
  const { id = '' } = useParams()
  const { pathname } = useLocation()
  const lesson = getLesson(id)
  if (!lesson) return <NotFound />
  return (
    <>
      <TopBar back="/" title={`${lesson.number}. ${lesson.title}`} sub={`Level ${lesson.level} · ${lesson.titleVi}`} />
      {/* đổi tab: chỉ nội dung mờ dần vào, thanh tiêu đề và thanh tab đứng yên */}
      <main key={pathname} className="page with-tabs tab-fade">
        <Outlet />
      </main>
      <TabBar lessonId={lesson.id} />
    </>
  )
}

function NotFound() {
  return (
    <>
      <TopBar back="/" title="Không tìm thấy" />
      <main className="page center">
        <p>Không tìm thấy nội dung này.</p>
      </main>
    </>
  )
}

/**
 * Hiệu ứng chuyển trang: đi tới trượt vào từ phải, quay lại trượt vào từ trái.
 * Các tab trong cùng một bài dùng chung khung nên không trượt cả trang.
 */
function AnimatedRoutes() {
  const location = useLocation()
  const navType = useNavigationType()
  const first = useRef(true)
  const key = location.pathname.replace(/^(\/lesson\/[^/]+)\/(phrases|roleplay|grammar)$/, '$1')
  // nút ← / "Về danh sách" gắn state.back để chạy hiệu ứng quay lại
  const goingBack = navType === 'POP' || (location.state as { back?: boolean } | null)?.back
  let dir = goingBack ? 'back' : 'fwd'
  if (first.current || navType === 'REPLACE') dir = 'none'
  first.current = false
  return (
    <div key={key} className={`route-anim ${dir}`}>
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/lesson/:id" element={<LessonTabs />}>
          <Route index element={<Navigate to="phrases" replace />} />
          <Route path="phrases" element={<PhrasesPage />} />
          <Route path="roleplay" element={<RoleplayPage />} />
          <Route path="grammar" element={<GrammarPage />} />
        </Route>
        <Route path="/lesson/:id/phrases/:game" element={<GamePage />} />
        <Route path="/lesson/:id/roleplay/dialogue/:idx/:mode" element={<DialoguePage />} />
        <Route path="/lesson/:id/roleplay/mission/:idx" element={<MissionPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <ProgressProvider>
      <HashRouter>
        <div className="app">
          <AnimatedRoutes />
        </div>
      </HashRouter>
    </ProgressProvider>
  )
}
