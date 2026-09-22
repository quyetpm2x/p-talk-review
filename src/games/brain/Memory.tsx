import { useEffect, useMemo, useRef, useState } from 'react'
import type { CustomGameProps } from '../types'
import { pickItems, type Item } from '../../lib/picker'
import { shuffle } from '../../lib/shuffle'
import { useProgress } from '../../lib/ProgressContext'
import { speak } from '../../lib/speech'
import { cleanPhrase } from '../../lib/scoring'
import { sfx } from '../../lib/sfx'
import { buzz } from '../../lib/haptics'
import { burst, celebrate } from '../../lib/fx'
import { memoryScore, mismatchBlame } from './logic'
import './brain.css'

const PAIRS = 6
const MISMATCH_MS = 900

type Mode = 'vi' | 'syn'
type Face = 'en' | 'vi' | 'syn'
type Card = { key: string; pair: string; item: Item; face: Face; text: string }

/** Chọn tối đa 6 cụm (ưu tiên bộ đang chọn, thiếu thì lấy thêm từ toàn bài), không trùng chữ hiển thị. */
function pickPairs(items: Item[], pool: Item[], mode: Mode, rank: (list: Item[], n: number) => Item[]): Item[] {
  const ok = (i: Item) => (mode === 'syn' ? !!i.synonym : true)
  const out: Item[] = []
  const used = new Set<string>()
  const add = (i: Item) => {
    const texts = [i.en, mode === 'syn' ? i.synonym! : i.vi].map((t) => t.toLowerCase())
    if (out.length >= PAIRS || out.some((o) => o.id === i.id) || texts.some((t) => used.has(t))) return
    texts.forEach((t) => used.add(t))
    out.push(i)
  }
  rank(items.filter(ok), PAIRS).forEach(add)
  if (out.length < PAIRS) shuffle(pool.filter(ok)).forEach(add)
  return out
}

/** Số cụm có thể chơi ở chế độ đồng nghĩa (cụm khác nhau có synonym). */
export const synonymCount = (items: Item[], pool: Item[]) =>
  new Set([...items, ...pool].filter((i) => i.synonym).map((i) => i.id)).size

export function Memory({ lesson, items, pool, record, finish }: CustomGameProps) {
  const [mode, setMode] = useState<Mode | null>(null)
  const synOk = synonymCount(items, pool) >= 3

  if (!mode) {
    return (
      <div className="stack brain-intro" style={{ gap: 16 }}>
        <div className="card stack center" style={{ gap: 6 }}>
          <div style={{ fontSize: 44, lineHeight: 1 }}>🃏</div>
          <div className="prompt-vi">Lật 2 thẻ một lần — tìm đủ 6 cặp</div>
          <div className="muted small">Càng ít lượt lật càng nhiều điểm. Nhớ vị trí các thẻ đã thấy nhé!</div>
        </div>
        <div className="label">Chọn kiểu ghép cặp</div>
        <div className="grid-2">
          <button className="mode-btn brain-mode" onClick={() => setMode('vi')}>
            <span style={{ fontSize: 26 }}>🇬🇧 ↔ 🇻🇳</span>
            <span>Anh – Việt</span>
            <span className="muted small" style={{ fontWeight: 500 }}>Câu tiếng Anh ↔ nghĩa</span>
          </button>
          <button className="mode-btn brain-mode" disabled={!synOk} onClick={() => setMode('syn')}>
            <span style={{ fontSize: 26 }}>≈</span>
            <span>Đồng nghĩa</span>
            <span className="muted small" style={{ fontWeight: 500 }}>{synOk ? 'Câu ↔ câu cùng nghĩa' : 'Bộ này chưa có câu đồng nghĩa'}</span>
          </button>
        </div>
      </div>
    )
  }
  return <Board mode={mode} lesson={lesson} items={items} pool={pool} record={record} finish={finish} />
}

function Board({ mode, lesson, items, pool, record, finish }: CustomGameProps & { mode: Mode }) {
  const [p] = useProgress()
  const cards = useMemo<Card[]>(() => {
    const rank = (list: Item[], n: number) => pickItems(list, p.phrases, lesson.id, n, Date.now())
    const chosen = pickPairs(items, pool, mode, rank)
    return shuffle(chosen.flatMap((i): Card[] => [
      { key: `${i.id}:en`, pair: i.id, item: i, face: 'en', text: i.en },
      mode === 'syn'
        ? { key: `${i.id}:syn`, pair: i.id, item: i, face: 'syn', text: i.synonym! }
        : { key: `${i.id}:vi`, pair: i.id, item: i, face: 'vi', text: i.vi },
    ]))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const pairs = cards.length / 2
  const byKey = useMemo(() => new Map(cards.map((c) => [c.key, c])), [cards])
  const partnerOf = (key: string) => cards.find((c) => c.pair === byKey.get(key)!.pair && c.key !== key)!.key

  const [open, setOpen] = useState<string[]>([])
  const [matched, setMatched] = useState<Set<string>>(new Set())
  const [shake, setShake] = useState<string[]>([])
  const [bounce, setBounce] = useState<string[]>([])
  const [turns, setTurns] = useState(0)
  const busy = useRef(false)
  const seen = useRef(new Set<string>())
  const blamed = useRef(new Set<string>())
  const answers = useRef<{ item: Item; correct: boolean }[]>([])
  const start = useRef(Date.now())
  const [now, setNow] = useState(Date.now())
  const timers = useRef<number[]>([])
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => { clearInterval(t); timers.current.forEach(clearTimeout) }
  }, [])
  const secs = Math.floor((now - start.current) / 1000)

  const tap = (c: Card, el: HTMLElement) => {
    if (busy.current || open.includes(c.key) || matched.has(c.pair)) return
    sfx('tick')
    const nextOpen = [...open, c.key]
    setOpen(nextOpen)
    if (nextOpen.length < 2) return
    busy.current = true
    const t = turns + 1
    setTurns(t)
    const [a, b] = nextOpen.map((k) => byKey.get(k)!)
    if (a.pair === b.pair) {
      later(() => {
        const ok = !blamed.current.has(a.pair)
        record(a.pair, ok)
        answers.current.push({ item: a.item, correct: ok })
        const m = new Set(matched).add(a.pair)
        setMatched(m)
        setBounce([a.key, b.key])
        setOpen([])
        busy.current = false
        sfx('ok')
        buzz(true)
        const r = el.getBoundingClientRect()
        burst(r.left + r.width / 2, r.top + r.height / 2, 18)
        speak(cleanPhrase(a.item.en))
        if (m.size === pairs) {
          later(() => { sfx('win'); celebrate() }, 500)
          later(() => {
            const list = answers.current
            finish({
              score: memoryScore(t, pairs),
              correct: list.filter((x) => x.correct).length,
              total: pairs,
              wrong: list.filter((x) => !x.correct).map((x) => x.item),
              answers: list,
              seconds: Math.round((Date.now() - start.current) / 1000),
            })
          }, 1900)
        }
      }, 420)
    } else {
      mismatchBlame(a, b, seen.current, partnerOf).forEach((pair) => blamed.current.add(pair))
      later(() => { setShake([a.key, b.key]); buzz(false) }, 450)
      later(() => { setShake([]); setOpen([]); busy.current = false }, MISMATCH_MS + 350)
    }
    seen.current.add(a.key)
    seen.current.add(b.key)
  }

  const tagOf = (f: Face) => (f === 'en' ? 'EN' : f === 'vi' ? 'VI' : '≈')

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 8 }}>
        <div className="q-label grow">{mode === 'syn' ? 'Ghép câu với câu đồng nghĩa' : 'Ghép câu tiếng Anh với nghĩa'}</div>
        <span className="tag accent" aria-label="Số cặp đã tìm">✓ {matched.size}/{pairs}</span>
        <span className="tag" aria-label="Số lượt lật">🔄 {turns}</span>
        <span className="tag" aria-label="Thời gian">⏱ {secs}s</span>
      </div>
      <div className="mem-grid" style={{ '--rows': Math.ceil(cards.length / 3) } as React.CSSProperties}>
        {cards.map((c) => {
          const up = open.includes(c.key) || matched.has(c.pair)
          const cls = [
            'mem-card', up && 'up', matched.has(c.pair) && 'done',
            shake.includes(c.key) && 'miss', bounce.includes(c.key) && 'hit',
          ].filter(Boolean).join(' ')
          return (
            <button key={c.key} className={cls} onClick={(e) => tap(c, e.currentTarget)}
              aria-label={up ? c.text : 'Thẻ úp — chạm để lật'} aria-pressed={up}>
              <span className="mem-inner">
                <span className="mem-face mem-back" aria-hidden><span className="mem-logo">P</span></span>
                <span className={`mem-face mem-front f-${c.face}`} lang={c.face === 'vi' ? 'vi' : 'en'}>
                  <span className="mem-tag">{tagOf(c.face)}</span>
                  <span className="mem-text">{c.text}</span>
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <div className="muted small center">Điểm = 200 − 10 × (số lượt thừa so với {pairs} lượt tối thiểu)</div>
    </div>
  )
}
