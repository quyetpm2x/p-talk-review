import { HashRouter, Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
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

export default function App() {
  return (
    <ProgressProvider>
      <HashRouter>
        <div className="app">
          <Routes>
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
      </HashRouter>
    </ProgressProvider>
  )
}
