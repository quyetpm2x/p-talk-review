import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getLesson } from '../lessons'
import { getGame } from '../games/registry'
import { GameShell } from '../games/GameShell'
import type { FinishResult } from '../games/types'
import { phrasePool, type Item } from '../lib/picker'
import { useProgress } from '../lib/ProgressContext'
import { recordAnswer, setBest } from '../lib/progress'
import { TopBar } from '../components/TopBar'
import { ResultScreen } from '../components/ResultScreen'

export function GamePage() {
  const { id = '', game = '' } = useParams()
  const [sp] = useSearchParams()
  const set = sp.get('set') ?? 'all'
  const nav = useNavigate()
  const lesson = getLesson(id)
  const def = getGame(game)
  const [p, update] = useProgress()
  const [run, setRun] = useState(0)
  const [result, setResult] = useState<(FinishResult & { prevBest: number }) | null>(null)
  const [fixed, setFixed] = useState<Item[] | undefined>()

  // Lên đầu trang khi mở trang thống kê hoặc bắt đầu lượt mới
  useEffect(() => { window.scrollTo(0, 0) }, [result, run])

  const { items, pool } = useMemo(() => {
    if (!lesson || !def) return { items: [], pool: [] }
    return {
      items: phrasePool(lesson, set).filter(def.eligible),
      pool: phrasePool(lesson, set === 'extra' ? 'extra' : 'all').filter(def.eligible),
    }
  }, [lesson, def, set])

  const back = `/lesson/${id}/phrases${set !== 'all' ? `?set=${set}` : ''}`
  if (!lesson || !def) return <><TopBar back="/" title="Không tìm thấy trò chơi" /><main className="page" /></>

  const bestKey = `${lesson.id}:${def.id}`
  const lock = def.lockReason(items, set)
  const record = (itemId: string, correct: boolean) => update((pp) => recordAnswer(pp, lesson.id, itemId, correct, Date.now()))
  const finish = (raw: FinishResult) => {
    // Thẻ lật không tính điểm: dùng số cụm đã nhớ làm điểm
    const r = def.autoNext ? { ...raw, score: raw.correct } : raw
    const prevBest = p.bestScores[bestKey] ?? 0
    if (!fixed) update((pp) => setBest(pp, bestKey, r.score))
    setResult({ ...r, prevBest })
  }
  const restart = (f?: Item[]) => {
    setFixed(f)
    setResult(null)
    setRun((x) => x + 1)
  }
  const setName = set === 'all' ? 'Tất cả' : set === 'extra' ? 'Cụm gợi ý thêm' : lesson.groups.find((g) => g.id === set)?.vi

  return (
    <>
      <TopBar back={back} title={`${def.icon} ${def.name}`} sub={`Bài ${lesson.number} · ${setName}`} />
      <main className="page">
        {lock ? (
          <div className="card center stack" style={{ padding: 28 }}>
            <div style={{ fontSize: 44 }}>🔒</div>
            <div>{lock}</div>
            <button className="btn btn-primary" onClick={() => nav(back)}>Quay lại</button>
          </div>
        ) : result ? (
          <ResultScreen
            score={result.score}
            best={fixed ? undefined : Math.max(result.prevBest, result.score)}
            total={result.total}
            correct={result.correct}
            wrong={result.wrong}
            answers={result.answers}
            seconds={result.seconds}
            onRetry={() => restart()}
            onReviewWrong={def.Question ? () => restart(result.wrong) : undefined}
            onExit={() => nav(back)}
            unit={def.autoNext ? `/ ${result.total} cụm đã nhớ` : 'điểm'}
          />
        ) : def.Custom ? (
          <def.Custom key={run} lesson={lesson} items={items} pool={pool} record={record} finish={finish} />
        ) : (
          <GameShell key={run} def={def} lesson={lesson} items={items} pool={pool} record={record} finish={finish} fixed={fixed} />
        )}
      </main>
    </>
  )
}
