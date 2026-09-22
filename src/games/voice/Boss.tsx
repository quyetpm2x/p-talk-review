import { useEffect, useMemo, useRef, useState } from 'react'
import type { CustomGameProps } from '../types'
import { ArcadeShell, type ArcadeApi } from '../arcade/ArcadeShell'
import { distractors, pickItems, type Item } from '../../lib/picker'
import { useProgress } from '../../lib/ProgressContext'
import { shuffle } from '../../lib/shuffle'
import { hasRecognition, type ListenError } from '../../lib/recognition'
import { listenSafe } from './listenSafe'
import { cleanPhrase, matchedWords, matchRatio, displayTokens } from '../../lib/scoring'
import { speak, stopSpeaking } from '../../lib/speech'
import { sfx } from '../../lib/sfx'
import { burst, celebrate } from '../../lib/fx'
import { MicButton } from '../../components/MicButton'
import { BossSprite, type BossMood } from './BossSprite'
import {
  BOSS_HP, EASY_TURNS, HIT_RATIO, OUCH, TAUNT, applyDamage, hpPercent, hpTone, strikeDamage, turnMs,
} from './bossLogic'
import './voice.css'

export function Boss(props: CustomGameProps) {
  return (
    <ArcadeShell {...props}
      hint={<>Nói to câu tiếng Anh để <b>tung đòn</b> ⚔️<br />Nói sai hoặc để hết giờ, boss sẽ <b>phản đòn</b>!</>}>
      {(api) => <Arena api={api} {...props} />}
    </ArcadeShell>
  )
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

const MIC_OFF: Partial<Record<ListenError, string>> = {
  unsupported: 'Trình duyệt chưa hỗ trợ nhận diện giọng nói',
  denied: 'Chưa được cấp quyền micro',
  network: 'Nhận diện giọng nói cần mạng',
}

type Pop = { id: number; text: string; crit: boolean }
type Piece = { id: number; dx: number; dy: number; r: number; c: string; s: number }

function Arena({ api, lesson, items, pool }: CustomGameProps & { api: ArcadeApi }) {
  const [p] = useProgress()
  const queue = useMemo(() => {
    const base = pickItems(items, p.phrases, lesson.id, items.length, Date.now())
    return Array.from({ length: 40 }, (_, i) => base[i % base.length])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [qi, setQi] = useState(0)
  const q: Item = queue[qi]
  const target = cleanPhrase(q.en)

  const [mode, setMode] = useState<'mic' | 'choice'>(() => (hasRecognition() ? 'mic' : 'choice'))
  const [micNote, setMicNote] = useState<string | null>(hasRecognition() ? null : MIC_OFF.unsupported!)
  const [hp, setHp] = useState(BOSS_HP)
  const [streak, setStreak] = useState(0)
  const [mood, setMood] = useState<BossMood>('idle')
  const [bubble, setBubble] = useState<{ id: number; text: string } | null>(null)
  const [pops, setPops] = useState<Pop[]>([])
  const [slash, setSlash] = useState<{ id: number; crit: boolean } | null>(null)
  const [counter, setCounter] = useState(0) // số lần boss phản đòn (để chạy lại hiệu ứng)
  const [hitShake, setHitShake] = useState(0)
  const [pieces, setPieces] = useState<Piece[]>([])
  const [locked, setLocked] = useState(false)
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [hinted, setHinted] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const idRef = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const bossRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<HTMLSpanElement>(null)
  const stopRef = useRef<() => void>()
  const elapsed = useRef(0)
  const timers = useRef<number[]>([])
  const dead = hp <= 0
  const easy = qi < EASY_TURNS
  const total = turnMs(mode === 'mic', qi)

  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
  useEffect(() => () => { timers.current.forEach(clearTimeout); stopRef.current?.(); stopSpeaking() }, [])

  const opts = useMemo(
    () => shuffle([q, ...distractors(q, pool.length >= 3 ? pool : items, 2, (i) => i.en)]),
    [q, pool, items],
  )

  // refs cho vòng lặp đồng hồ
  const live = useRef({ api, locked, listening, dead, total, q })
  live.current = { api, locked, listening, dead, total, q }

  // Đồng hồ lượt: hết giờ thì boss phản đòn. Dừng khi tạm dừng / đang nghe / đang xử lý đòn.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = now - last
      last = now
      const L = live.current
      if (L.api.running && !L.locked && !L.listening && !L.dead) {
        elapsed.current += dt
        if (elapsed.current >= L.total) {
          elapsed.current = 0
          bossCounter('⏰ Hết giờ!')
        }
      }
      if (timerRef.current) timerRef.current.style.transform = `scaleX(${Math.max(0, 1 - elapsed.current / L.total)})`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Chỗ hiện điểm cộng/trừ: ngay trên khung đề bài (không che chữ) */
  const popAt = () => {
    const root = rootRef.current?.getBoundingClientRect()
    const r = rootRef.current?.querySelector('.boss-panel')?.getBoundingClientRect()
    if (!root || !r) return { x: 180, y: 300 }
    return { x: r.left - root.left + r.width / 2, y: r.top - root.top - 22 }
  }

  const center = (el: HTMLElement | null) => {
    const root = rootRef.current?.getBoundingClientRect()
    const r = el?.getBoundingClientRect()
    if (!root || !r) return { x: 180, y: 160, sx: 180, sy: 160 }
    return { x: r.left - root.left + r.width / 2, y: r.top - root.top + r.height / 2, sx: r.left + r.width / 2, sy: r.top + r.height / 2 }
  }

  const nextTurn = () => {
    setQi((x) => Math.min(queue.length - 1, x + 1))
    setHeard(null)
    setHinted(false)
    setPicked(null)
    setNotice(null)
    elapsed.current = 0
    setLocked(false)
    setMood('idle')
  }

  const strike = (ratio: number) => {
    const s = strikeDamage({ ratio, streak, hinted, noCrit: mode === 'choice' })
    const nhp = applyDamage(hp, s.damage)
    const id = ++idRef.current
    setLocked(true)
    setHp(nhp)
    setStreak((k) => k + 1)
    setMood('hurt')
    setBubble({ id, text: nhp <= 0 ? 'NOOOO!' : pick(OUCH) })
    setSlash({ id, crit: s.crit })
    setHitShake((k) => k + 1)
    setPops((ps) => [...ps, { id, text: `−${s.damage}`, crit: s.crit }])
    later(() => setPops((ps) => ps.filter((x) => x.id !== id)), 1100)
    sfx('slice')
    later(() => sfx('boom'), 110)
    const c = center(bossRef.current)
    burst(c.sx, c.sy, s.crit ? 40 : 22)
    const me = popAt()
    api.hit({ item: q, points: s.damage, x: me.x, y: me.y, silent: true })
    if (mode === 'choice') later(() => speak(q.en), 250)

    if (nhp <= 0) {
      // Boss nổ tung
      later(() => {
        setMood('dead')
        const colors = ['#7c3aed', '#a78bfa', '#e11d48', '#fb7185', '#f3dc9f', '#4c1d95']
        setPieces(Array.from({ length: 18 }, (_, i) => {
          const a = (i / 18) * Math.PI * 2 + Math.random() * 0.4
          const d = 110 + Math.random() * 90
          return { id: i, dx: Math.cos(a) * d, dy: Math.sin(a) * d - 40, r: Math.random() * 720 - 360, c: colors[i % colors.length], s: 10 + Math.random() * 16 }
        }))
        sfx('boom')
        later(() => { sfx('win'); celebrate() }, 250)
        burst(c.sx, c.sy, 60)
      }, 650)
      later(() => api.end({}, { title: '🏆 Hạ gục boss!', sub: 'Quỷ Im Lặng đã bị đánh bại', ms: 2200 }), 1500)
      return
    }
    later(nextTurn, 1250)
  }

  function bossCounter(label: string) {
    const L = live.current
    if (L.dead) return
    const id = ++idRef.current
    setLocked(true)
    setStreak(0)
    setMood('attack')
    setBubble({ id, text: pick(TAUNT) })
    setCounter((k) => k + 1)
    const me = popAt()
    L.api.miss({ item: L.q, x: me.x, y: me.y, label: `${label} −1 ❤️` })
    later(nextTurn, 1500)
  }

  const startMic = () => {
    if (listening) return stopRef.current?.()
    if (!api.running || locked || dead) return
    setNotice(null)
    setHeard(null)
    const { promise, stop } = listenSafe(10000)
    stopRef.current = stop
    setListening(true)
    promise
      .then((alts) => {
        if (live.current.dead) return
        const best = alts.reduce(
          (b, a) => { const r = matchRatio(target, a); return r > b.r ? { a, r } : b },
          { a: alts[0] ?? '', r: -1 },
        )
        setHeard(best.a)
        if (best.r >= HIT_RATIO) strike(best.r)
        else bossCounter(`Khớp ${Math.round(Math.max(0, best.r) * 100)}%`)
      })
      .catch((e: ListenError) => {
        if (MIC_OFF[e]) { setMode('choice'); setMicNote(MIC_OFF[e]!) }
        else setNotice(e === 'no-speech' ? 'Không nghe thấy — bấm micro và nói to hơn nhé' : 'Đã dừng nghe — bấm micro để nói lại')
      })
      .finally(() => setListening(false))
  }

  const choose = (i: number) => {
    if (!api.running || locked || dead) return
    setPicked(i)
    if (opts[i] === q) strike(1)
    else bossCounter('Sai rồi!')
  }

  const marks = heard !== null ? matchedWords(target, heard) : null
  const pct = hpPercent(hp)
  const letters = displayTokens(target).map((w) => w[0] + '…').join(' ')

  return (
    <div ref={rootRef} className={`boss-arena ${hitShake ? (hitShake % 2 ? 'hit-a' : 'hit-b') : ''}`}>
      <div className="boss-hp">
        <div className="boss-hp-top">
          <span className="boss-name">👾 Quỷ Im Lặng</span>
          <span className="boss-hp-num">HP {hp}/{BOSS_HP}</span>
        </div>
        <div className="boss-hp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={BOSS_HP} aria-valuenow={hp} aria-label="Máu của boss">
          <span className="ghost" style={{ width: `${pct}%` }} />
          <span className={`fill ${hpTone(hp)}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="boss-zone">
        {counter > 0 && <div key={`c${counter}`} className="boss-flash" aria-hidden />}
        {counter > 0 && <div key={`b${counter}`} className="boss-beam" aria-hidden />}
        <div ref={bossRef} className={`boss-body mood-${mood}`}>
          {mood !== 'dead' && <BossSprite mood={mood} />}
          {slash && mood !== 'dead' && (
            <div key={slash.id} className="boss-slash" aria-hidden>
              <span />{slash.crit && <span className="x2" />}
            </div>
          )}
          {bubble && mood !== 'dead' && <div key={bubble.id} className="boss-bubble">{bubble.text}</div>}
          {pops.map((x) => (
            <div key={x.id} className={`boss-dmg ${x.crit ? 'crit' : ''}`}>
              {x.crit && <small>CHÍ MẠNG!</small>}{x.text}
            </div>
          ))}
          {pieces.map((pc) => (
            <span key={pc.id} className="boss-piece" aria-hidden
              style={{ '--dx': `${pc.dx}px`, '--dy': `${pc.dy}px`, '--r': `${pc.r}deg`, background: pc.c, width: pc.s, height: pc.s } as React.CSSProperties} />
          ))}
        </div>
      </div>

      <div className="boss-panel">
        <div className="boss-turn-label">
          {streak >= 2 ? `🔥 Chuỗi ${streak} đòn · ` : ''}{mode === 'mic' ? 'Nói câu tiếng Anh có nghĩa:' : 'Chọn câu tiếng Anh có nghĩa:'}
        </div>
        <div className="boss-vi" key={qi}>{q.vi}</div>
        {mode === 'mic' && (easy
          ? <div className="boss-en" lang="en">🗣 {target}</div>
          : hinted
            ? <div className="boss-en" lang="en">💡 {letters}</div>
            : <button type="button" className="boss-hint" onClick={() => setHinted(true)} disabled={locked}>💡 Gợi ý chữ cái đầu (đòn yếu hơn)</button>)}
        {marks && (
          <div className="boss-heard" lang="en">
            {displayTokens(target).map((w, i) => <span key={i} className={marks[i] ? 'w-ok' : 'w-miss'}>{w} </span>)}
          </div>
        )}
        <div className="boss-timer" aria-hidden><span ref={timerRef} /></div>

        {mode === 'mic' ? (
          <div className="boss-mic">
            <MicButton listening={listening} onClick={startMic} disabled={!api.running || locked} />
            <div className="boss-status">
              {notice ?? (listening ? 'Đang nghe… nói xong sẽ tự dừng' : locked ? '' : 'Bấm micro rồi nói — nói đúng là chém!')}
            </div>
            <button type="button" className="boss-link" onClick={() => { stopRef.current?.(); setMode('choice'); setMicNote('Bạn đã tắt micro') }}>
              Không dùng micro? Chơi chế độ chọn câu
            </button>
          </div>
        ) : (
          <div className="boss-choices">
            {micNote && <div className="boss-note">🎤✕ {micNote} — chọn câu đúng để tấn công, và <b>đọc to</b> câu đó nhé!</div>}
            {opts.map((o, i) => (
              <button key={`${qi}-${o.id}`} type="button" lang="en"
                className={`boss-choice ${picked === i ? (o === q ? 'right' : 'wrong') : ''} ${picked !== null && picked !== i && o === q ? 'reveal' : ''}`}
                disabled={!api.running || locked} onClick={() => choose(i)}>
                {o.en}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
