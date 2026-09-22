import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CustomGameProps, FinishResult } from '../types'
import type { Item } from '../../lib/picker'
import { isMuted, setMuted, sfx } from '../../lib/sfx'
import { burst } from '../../lib/fx'
import { buzz } from '../../lib/haptics'

export type ArcadeApi = {
  /** Đang chơi (đã đếm ngược xong, chưa tạm dừng, chưa kết thúc) */
  running: boolean
  paused: boolean
  level: number
  lives: number
  /** Trả lời đúng: cộng điểm (nhân combo), lưu Leitner, hiệu ứng tại (x, y) */
  hit: (o: { item: Item; points: number; x?: number; y?: number; silent?: boolean }) => void
  /** Sai / để lọt: trừ mạng, lưu Leitner nếu có item */
  miss: (o: { item?: Item; x?: number; y?: number; label?: string; loseLife?: boolean; sound?: 'bad' | 'boom' }) => void
  /** Kết thúc lượt (thắng, hết câu…) */
  end: (o?: Partial<FinishResult>) => void
}

type Popup = { id: number; x: number; y: number; text: string; bad?: boolean }

const MAX_LIVES = 3

/**
 * Khung chung cho trò hành động: đếm ngược, HUD, tạm dừng, hiệu ứng, hết mạng.
 * Trò con nhận `api` và tự vẽ sân chơi bên trong vùng `.arcade-stage`.
 */
export function ArcadeShell({ record, finish, hint, children, lives: startLives = MAX_LIVES, showLives = true }: Pick<CustomGameProps, 'record' | 'finish'> & {
  hint: ReactNode
  lives?: number
  /** false: trò không dùng mạng (không hiện ❤️) */
  showLives?: boolean
  children: (api: ArcadeApi) => ReactNode
}) {
  const nav = useNavigate()
  const [count, setCount] = useState(3)
  const [paused, setPaused] = useState(false)
  const [over, setOver] = useState<null | 'lose' | 'done'>(null)
  const [lives, setLives] = useState(startLives)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [hits, setHits] = useState(0)
  const [muted, setMutedState] = useState(isMuted())
  const [popups, setPopups] = useState<Popup[]>([])
  const [shake, setShake] = useState(0)
  const answers = useRef<{ item: Item; correct: boolean }[]>([])
  const scoreRef = useRef(0)
  const comboRef = useRef(0)
  const livesRef = useRef(startLives)
  const startedAt = useRef(0)
  const pausedMs = useRef(0)
  const pauseStart = useRef(0)
  const popId = useRef(0)
  const ended = useRef(false)
  const stageRef = useRef<HTMLDivElement>(null)

  // Đếm ngược 3-2-1
  useEffect(() => {
    if (count <= 0) return
    sfx(count === 1 ? 'go' : 'tick')
    const t = setTimeout(() => {
      setCount((c) => c - 1)
      if (count === 1) startedAt.current = Date.now()
    }, 700)
    return () => clearTimeout(t)
  }, [count])

  // Tự tạm dừng khi rời tab
  useEffect(() => {
    const onVis = () => document.hidden && togglePause(true)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  const running = count <= 0 && !paused && !over

  const togglePause = (force?: boolean) => {
    if (count > 0 || over) return
    const next = force ?? !paused
    if (next === paused) return
    if (next) pauseStart.current = Date.now()
    else pausedMs.current += Date.now() - pauseStart.current
    setPaused(next)
  }

  const popup = (x: number | undefined, y: number | undefined, text: string, bad?: boolean) => {
    if (x === undefined || y === undefined) return
    const id = ++popId.current
    setPopups((p) => [...p, { id, x, y, text, bad }])
    setTimeout(() => setPopups((p) => p.filter((q) => q.id !== id)), 900)
  }

  const doFinish = useCallback((o: Partial<FinishResult> = {}) => {
    if (ended.current) return
    ended.current = true
    const a = answers.current
    finish({
      score: scoreRef.current,
      correct: a.filter((x) => x.correct).length,
      total: a.length,
      wrong: a.filter((x) => !x.correct).map((x) => x.item),
      answers: a,
      seconds: Math.round((Date.now() - startedAt.current - pausedMs.current) / 1000),
      ...o,
    })
  }, [finish])

  const api: ArcadeApi = {
    running,
    paused,
    level: Math.floor(hits / 5),
    lives,
    hit: ({ item, points, x, y, silent }) => {
      if (ended.current) return
      record(item.id, true)
      answers.current.push({ item, correct: true })
      comboRef.current += 1
      const mult = comboRef.current >= 10 ? 3 : comboRef.current >= 5 ? 2 : 1
      scoreRef.current += points * mult
      setScore(scoreRef.current)
      setCombo(comboRef.current)
      setHits((h) => h + 1)
      popup(x, y, `+${points * mult}${mult > 1 ? ` ×${mult}` : ''}`)
      if (x !== undefined && y !== undefined) {
        const r = stageRef.current?.getBoundingClientRect()
        burst(x + (r?.left ?? 0), y + (r?.top ?? 0), comboRef.current >= 5 ? 36 : 20)
      }
      if (!silent) sfx('ok')
      buzz(true)
    },
    miss: ({ item, x, y, label, loseLife = true, sound = 'bad' }) => {
      if (ended.current) return
      if (item) {
        record(item.id, false)
        answers.current.push({ item, correct: false })
      }
      comboRef.current = 0
      setCombo(0)
      sfx(sound)
      buzz(false)
      popup(x, y, label ?? (loseLife ? '−1 ❤️' : '✕'), true)
      if (!loseLife) return
      setShake((s) => s + 1)
      livesRef.current -= 1
      setLives(livesRef.current)
      if (livesRef.current <= 0) {
        setOver('lose')
        sfx('lose')
        setTimeout(() => doFinish(), 1400)
      }
    },
    end: (o) => {
      if (ended.current || over) return
      setOver('done')
      setTimeout(() => doFinish(o), 900)
    },
  }

  return (
    <div className="arcade">
      <div className="arcade-hud">
        {showLives && (
          <span className="hud-lives" aria-label={`Còn ${lives} mạng`}>
            {Array.from({ length: startLives }, (_, i) => (
              <span key={i} className={i < lives ? 'heart' : 'heart lost'}>❤️</span>
            ))}
          </span>
        )}
        {combo >= 2 && <span key={combo} className="hud-combo">🔥 {combo}</span>}
        <span className="grow" />
        <span className="score-pill hud-score" key={score}>{score}</span>
        <button className="hud-btn" aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          onClick={() => { setMuted(!muted); setMutedState(!muted) }}>{muted ? '🔇' : '🔊'}</button>
        <button className="hud-btn" aria-label="Tạm dừng" onClick={() => togglePause(true)} disabled={count > 0 || !!over}>⏸</button>
      </div>

      <div ref={stageRef} className={`arcade-stage ${shake % 2 ? 'shake-a' : shake ? 'shake-b' : ''} ${running ? '' : 'is-paused'}`}>
        <div className="arcade-field">{children(api)}</div>
        {popups.map((p) => (
          <span key={p.id} className={`score-pop ${p.bad ? 'bad' : ''}`} style={{ left: p.x, top: p.y }}>{p.text}</span>
        ))}

        {count > 0 && (
          <div className="arcade-overlay">
            <div className="arcade-hint">{hint}</div>
            <div key={count} className="countdown">{count}</div>
          </div>
        )}
        {paused && (
          <div className="arcade-overlay">
            <div className="arcade-card">
              <div style={{ fontSize: 40 }}>⏸</div>
              <strong>Tạm dừng</strong>
              <button className="btn btn-primary btn-block" onClick={() => togglePause(false)}>▶ Chơi tiếp</button>
              <button className="btn btn-ghost btn-block" onClick={() => nav(-1)}>Thoát</button>
            </div>
          </div>
        )}
        {over && (
          <div className="arcade-overlay">
            <div className="game-over">{over === 'lose' ? '💥 Hết mạng!' : '🏁 Về đích!'}</div>
          </div>
        )}
      </div>
    </div>
  )
}
