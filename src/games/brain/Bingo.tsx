import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CustomGameProps } from '../types'
import type { Item } from '../../lib/picker'
import { shuffle } from '../../lib/shuffle'
import { speak, stopSpeaking } from '../../lib/speech'
import { cleanPhrase } from '../../lib/scoring'
import { sfx } from '../../lib/sfx'
import { buzz } from '../../lib/haptics'
import { celebrate } from '../../lib/fx'
import { completedLines, reshuffleUnmarked } from './logic'
import './brain.css'

const SIZE = 4
const CELLS = SIZE * SIZE
const AUTO_OPTS = [6, 8, 10, 12]

/** 16 cụm có nghĩa tiếng Việt khác nhau (để ô không trùng chữ). */
export function bingoCandidates(items: Item[]): Item[] {
  const seen = new Set<string>()
  return items.filter((i) => {
    const k = i.vi.trim().toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

type Call = { item: Item; status: 'open' | 'ok' | 'late'; slip: boolean }

export function Bingo({ items, record, finish }: CustomGameProps) {
  const [board, setBoard] = useState(() => shuffle(bingoCandidates(items)).slice(0, CELLS))
  const order = useMemo(() => shuffle(board), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [calls, setCalls] = useState<Call[]>([])
  const [marked, setMarked] = useState<boolean[]>(() => Array(CELLS).fill(false))
  const markedRef = useRef(marked)
  markedRef.current = marked
  const [mixing, setMixing] = useState(false) // nhãn “Xáo trộn!”
  const gridRef = useRef<HTMLDivElement>(null)
  const prevRects = useRef<Map<string, DOMRect> | null>(null)
  const [shake, setShake] = useState<number | null>(null)
  const [showText, setShowText] = useState(true)
  const [auto, setAuto] = useState(false)
  const [autoSec, setAutoSec] = useState(8)
  const [big, setBig] = useState(false)
  const [flash, setFlash] = useState(false) // hiệu ứng chữ BINGO!
  const [score, setScore] = useState(0)
  const scoreRef = useRef(0)
  const lineCount = useRef(0)
  const start = useRef(Date.now())
  const rootRef = useRef<HTMLDivElement>(null)

  const current = calls[calls.length - 1]
  const lines = useMemo(() => completedLines(marked, SIZE), [marked])
  const inLine = useMemo(() => new Set(lines.flat()), [lines])
  const allCalled = calls.length >= order.length
  const addScore = (n: number) => { scoreRef.current += n; setScore(scoreRef.current) }

  const say = (it?: Item) => { if (it) speak(cleanPhrase(it.en)) }

  const callNext = () => {
    if (allCalled) return
    // Câu trước chưa đánh dấu → tính là chưa theo kịp (vẫn có thể đánh dấu muộn)
    const it = order[calls.length]
    setCalls((c) => [...c, { item: it, status: 'open', slip: false }])
    sfx('pop')
    say(it)
  }

  // Tự gọi câu tiếp sau mỗi N giây
  useEffect(() => {
    if (!auto || allCalled || flash) return
    const t = setTimeout(callNext, calls.length === 0 ? 300 : autoSec * 1000)
    return () => clearTimeout(t)
  }, [auto, autoSec, calls.length, allCalled, flash]) // eslint-disable-line react-hooks/exhaustive-deps

  const tapCell = (i: number) => {
    if (marked[i] || !calls.length) return
    const it = board[i]
    const ci = calls.findIndex((c) => c.item.id === it.id)
    if (ci < 0 || calls[ci].status !== 'open') {
      // Sai: ô rung đỏ, câu hiện tại bị tính "vấp"
      buzz(false)
      sfx('bad')
      setShake(i)
      setCalls((cs) => cs.map((c, k) => (k === cs.length - 1 ? { ...c, slip: true } : c)))
      // Rung xong → xáo lại vị trí các ô chưa đánh dấu (phạt: phải tìm lại)
      setTimeout(() => {
        setShake((s) => (s === i ? null : s))
        reshuffle()
      }, 450)
      return
    }
    const onTime = ci === calls.length - 1 && !calls[ci].slip
    record(it.id, onTime)
    addScore(onTime ? 10 : 5)
    buzz(true)
    sfx('ok')
    setCalls((cs) => cs.map((c, k) => (k === ci ? { ...c, status: onTime ? 'ok' : 'late' } : c)))
    const m = marked.slice()
    m[i] = true
    setMarked(m)
    const n = completedLines(m, SIZE).length
    if (n > lineCount.current) {
      addScore(30 * (n - lineCount.current))
      lineCount.current = n
      setFlash(true)
      sfx('win')
      celebrate()
      setTimeout(() => setFlash(false), 2200)
    }
  }

  /** Xáo các ô chưa đánh dấu, có hiệu ứng trượt (FLIP) tới chỗ mới. */
  const reshuffle = () => {
    const rects = new Map<string, DOMRect>()
    gridRef.current?.querySelectorAll<HTMLElement>('[data-id]').forEach((el) => rects.set(el.dataset.id!, el.getBoundingClientRect()))
    prevRects.current = rects
    setBoard((b) => reshuffleUnmarked(b, markedRef.current))
    setMixing(true)
    sfx('whoosh')
    setTimeout(() => setMixing(false), 900)
  }
  useLayoutEffect(() => {
    const rects = prevRects.current
    if (!rects || !gridRef.current) return
    prevRects.current = null
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    gridRef.current.querySelectorAll<HTMLElement>('[data-id]').forEach((el) => {
      const a = rects.get(el.dataset.id!)
      if (!a) return
      const b = el.getBoundingClientRect()
      const dx = a.left - b.left
      const dy = a.top - b.top
      if (!dx && !dy) return
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.3,1.3,.5,1)' })
    })
  }, [board])

  const end = () => {
    stopSpeaking()
    exitFs()
    const list = calls.map((c) => ({ item: c.item, correct: c.status === 'ok' }))
    // Câu đã gọi mà chưa đánh dấu → ghi là sai
    calls.filter((c) => c.status === 'open').forEach((c) => record(c.item.id, false))
    finish({
      score: scoreRef.current,
      correct: list.filter((x) => x.correct).length,
      total: list.length,
      wrong: list.filter((x) => !x.correct).map((x) => x.item),
      answers: list,
      seconds: Math.round((Date.now() - start.current) / 1000),
    })
  }

  const exitFs = () => {
    try { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}) } catch { /* bỏ qua */ }
  }
  const toggleBig = () => {
    const on = !big
    setBig(on)
    try {
      if (on) document.documentElement.requestFullscreen?.().catch(() => {})
      else exitFs()
    } catch { /* trình duyệt không hỗ trợ toàn màn hình */ }
  }
  // Thoát toàn màn hình bằng phím Esc → tắt chế độ màn hình lớn
  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) setBig(false) }
    document.addEventListener('fullscreenchange', onFs)
    return () => { document.removeEventListener('fullscreenchange', onFs); exitFs(); stopSpeaking() }
  }, [])

  const markedCount = marked.filter(Boolean).length

  return (
    <div ref={rootRef} className={`bingo ${big ? 'bingo-big' : ''}`}>
      <div className="bingo-top">
        <div className="bingo-caller card">
          <div className="row" style={{ gap: 10 }}>
            <div className="bingo-ball" aria-hidden>{calls.length || '?'}</div>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="label">{calls.length ? `Câu ${calls.length}/${order.length}` : 'Sẵn sàng?'}</div>
              <div className="bingo-call" lang="en" aria-live="polite">
                {!current ? 'Bấm “Gọi câu” để bắt đầu' : showText ? current.item.en : <span className="muted">🔊 Nghe và tìm nghĩa…</span>}
              </div>
            </div>
          </div>
          <div className="bingo-actions">
            <button className="btn btn-primary grow" onClick={allCalled ? end : callNext}>
              {calls.length ? (allCalled ? '🏆 Xem kết quả' : 'Gọi câu tiếp →') : '▶ Gọi câu đầu tiên'}
            </button>
            <button className="btn btn-ghost" onClick={() => say(current?.item)} disabled={!current} aria-label="Đọc lại">🔁 Đọc lại</button>
          </div>
          <div className="bingo-opts">
            <label className="bingo-toggle">
              <input type="checkbox" checked={showText} onChange={(e) => setShowText(e.target.checked)} /> Hiện chữ
            </label>
            <label className="bingo-toggle">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Tự động
            </label>
            {auto && (
              <select className="bingo-sel" value={autoSec} onChange={(e) => setAutoSec(+e.target.value)} aria-label="Số giây mỗi câu">
                {AUTO_OPTS.map((s) => <option key={s} value={s}>{s} giây</option>)}
              </select>
            )}
            <button className="bingo-toggle" onClick={toggleBig} aria-pressed={big}>
              {big ? '↙ Thu nhỏ' : '📺 Chiếu lớn'}
            </button>
          </div>
          {auto && !allCalled && calls.length > 0 && !flash && (
            <div className="bingo-timer" key={`${calls.length}-${autoSec}`} style={{ animationDuration: `${autoSec}s` }} aria-hidden />
          )}
        </div>
      </div>

      <div className={`bingo-grid ${mixing ? 'mixing' : ''}`} aria-label="Bảng bingo" ref={gridRef}>
        {mixing && <div className="bingo-mix" aria-live="polite">🔀 Xáo trộn!</div>}
        {board.map((it, i) => (
          <button key={it.id} data-id={it.id}
            className={`bingo-cell ${marked[i] ? 'on' : ''} ${inLine.has(i) ? 'line' : ''} ${shake === i ? 'no' : ''}`}
            onClick={() => tapCell(i)} aria-pressed={marked[i]}>
            <span>{it.vi}</span>
            {marked[i] && <i className="bingo-stamp" aria-hidden>★</i>}
          </button>
        ))}
      </div>

      <div className="row bingo-foot">
        <span className="tag accent">★ {markedCount}/{CELLS}</span>
        <span className="tag">🎯 {lines.length} đường</span>
        <span className="score-pill">{score}</span>
        <span className="grow" />
        <button className="btn btn-dark btn-sm" onClick={end} disabled={!calls.length}>
          {lines.length ? '🏆 Kết thúc' : 'Kết thúc'}
        </button>
      </div>
      {!big && <div className="muted small center">Nghe câu tiếng Anh → chạm ô nghĩa đúng. Đủ 1 hàng, cột hoặc đường chéo là BINGO!</div>}

      {flash && (
        <div className="bingo-flash" role="alert">
          <span>BINGO!</span>
        </div>
      )}
    </div>
  )
}
