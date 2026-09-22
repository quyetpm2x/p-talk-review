import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom'
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
  const lesson = getLesson(id)
  if (!lesson) return <NotFound />
  return (
    <>
      <TopBar back="/" title={`${lesson.number}. ${lesson.title}`} sub={`Level ${lesson.level} · ${lesson.titleVi}`} />
      <main className="page with-tabs">
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
 * Hiệu ứng chuyển trang giữa Trang chủ và bài học (cả 2 chiều): trang cũ mờ dần rồi biến mất,
 * sau đó trang mới hiện từ mờ đến rõ nét. Các chuyển trang khác đổi ngay, không hiệu ứng.
 */
const OUT_MS = 200
const IN_MS = 400 // thời gian trang mới hiện rõ (khớp pageIn trong base.css)
const pageKey = (pathname: string) => pathname.replace(/^(\/lesson\/[^/]+)\/(phrases|roleplay|grammar)$/, '$1')

function AnimatedRoutes() {
  const location = useLocation()
  const [shown, setShown] = useState(location)
  const [stage, setStage] = useState<'none' | 'out' | 'in'>('none')

  useEffect(() => {
    if (location.key === shown.key) return
    // Chỉ làm hiệu ứng giữa Trang chủ và bài học (cả 2 chiều); mọi chuyển trang khác đổi ngay
    const isHome = (p: string) => p === '/'
    const isLesson = (p: string) => p.startsWith('/lesson/')
    const homeLesson =
      (isHome(shown.pathname) && isLesson(location.pathname)) || (isLesson(shown.pathname) && isHome(location.pathname))
    if (!homeLesson) {
      const samePage = pageKey(location.pathname) === pageKey(shown.pathname) // đổi tab trong bài
      setShown(location)
      setStage('none')
      if (!samePage) window.scrollTo(0, 0)
      return
    }
    setStage('out')
    let t2: ReturnType<typeof setTimeout>
    const t = setTimeout(() => {
      setShown(location)
      setStage('in')
      window.scrollTo(0, 0)
      // hiện xong thì bỏ trạng thái để lần đổi tab sau không làm nhòe lại cả trang
      t2 = setTimeout(() => setStage('none'), IN_MS)
    }, OUT_MS)
    return () => { clearTimeout(t); clearTimeout(t2) }
  }, [location]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div key={pageKey(shown.pathname)} className={`route-anim ${stage}`}>
      <Routes location={shown}>
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
