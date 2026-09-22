import { useEffect, useMemo, useRef, useState } from 'react'
import type { CustomGameProps } from '../types'
import { ArcadeShell, type ArcadeApi } from './ArcadeShell'
import { distractors, pickItems, type Item } from '../../lib/picker'
import { shuffle } from '../../lib/shuffle'
import { levelSpeed, makeBomb, segmentHitsRect, type Pt } from '../../lib/arcade'
import { sfx } from '../../lib/sfx'
import { speak } from '../../lib/speech'
import { useProgress } from '../../lib/ProgressContext'

const ROUNDS = 12
// Trọng lực (px/s²) chọn cùng với độ cao đỉnh bên dưới để tổng thời gian bay lên + rơi
// dài hơn ~30% so với bản đầu (trọng lực 1500, đỉnh 22–40%)
// Mỗi thẻ trong đợt bay tới một tầng riêng để không chồng lên nhau
const PEAK_TIERS = [0.16, 0.27, 0.38]
const GRAVITY = 930
const FLIGHT_SCALE = 1.3

type Kind = 'target' | 'decoy' | 'bomb'
type Flyer = {
  id: string; kind: Kind; text: string; item?: Item
  x: number; y: number; vx: number; vy: number; rot: number; vr: number
  w: number; h: number; state: 'fly' | 'cut' | 'boom'; cutAngle: number
}

export function Ninja(props: CustomGameProps) {
  return (
    <ArcadeShell {...props} hint={<>Vuốt để <b>chém</b> câu tiếng Anh đúng nghĩa.<br />Cẩn thận <b>💣 câu sai ngữ pháp</b> trông rất giống!</>}>
      {(api) => <Field api={api} {...props} />}
    </ArcadeShell>
  )
}

function Field({ api, lesson, items, pool }: CustomGameProps & { api: ArcadeApi }) {
  const [p] = useProgress()
  const targets = useMemo(() => pickItems(items, p.phrases, lesson.id, ROUNDS, Date.now()), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [round, setRound] = useState(0)
  const target = targets[round]
  const fieldRef = useRef<HTMLDivElement>(null)
  const flyers = useRef<Flyer[]>([])
  const [, setTick] = useState(0)
  const resolved = useRef(false)
  const trail = useRef<(Pt & { t: number })[]>([])
  const drawing = useRef(false)
  // mỗi nhát vuốt chỉ tính thẻ đầu tiên lưỡi kiếm chạm vào
  const strokeUsed = useRef(false)
  const [reveal, setReveal] = useState<string | null>(null)
  const apiRef = useRef(api)
  apiRef.current = api

  // Tung một đợt thẻ mới
  useEffect(() => {
    if (!target) return
    const el = fieldRef.current!
    const W = el.clientWidth, H = el.clientHeight
    const bomb = makeBomb(target.en)
    const decoys = distractors(target, pool, bomb ? 1 : 2, (i) => i.en)
    const list: { kind: Kind; text: string; item?: Item }[] = shuffle([
      { kind: 'target', text: target.en, item: target },
      ...decoys.map((d) => ({ kind: 'decoy' as Kind, text: d.en, item: d })),
      ...(bomb ? [{ kind: 'bomb' as Kind, text: bomb }] : []),
    ])
    const speed = levelSpeed(apiRef.current.level)
    const tiers = shuffle(PEAK_TIERS)
    flyers.current = list.map((f, k) => {
      const w = Math.min(170, W * 0.44), h = 64
      const x0 = W * (0.18 + 0.64 * ((k + 0.5) / list.length)) + (Math.random() - 0.5) * 30
      // tâm thẻ bay lên tới tầng riêng (16% / 27% / 38% chiều cao sân) ± một chút
      const peak = H * (tiers[k % tiers.length] + (Math.random() - 0.5) * 0.04)
      // thẻ tung sau xuất phát sâu hơn; tính vận tốc từ đúng điểm xuất phát để mọi thẻ tới cùng độ cao
      const y0 = H + h + k * 150
      const vy = -Math.sqrt(2 * GRAVITY * (y0 - peak)) * Math.min(1, 0.94 + speed * 0.05)
      return {
        id: `${round}-${k}`, ...f, x: x0, y: y0, vx: ((W / 2 - x0) * 0.12 + (Math.random() - 0.5) * 40) / FLIGHT_SCALE,
        vy, rot: (Math.random() - 0.5) * 12, vr: (Math.random() - 0.5) * 16, w, h, state: 'fly', cutAngle: 0,
      }
    })
    resolved.current = false
    setReveal(null)
  }, [round, target]) // eslint-disable-line react-hooks/exhaustive-deps

  // Vòng lặp vật lý
  useEffect(() => {
    let raf = 0, last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.04, (now - last) / 1000)
      last = now
      if (apiRef.current.running) {
        const H = fieldRef.current?.clientHeight ?? 700
        for (const f of flyers.current) {
          f.vy += GRAVITY * dt * (f.state === 'fly' ? 1 : 1.4)
          f.x += f.vx * dt
          f.y += f.vy * dt
          f.rot += f.vr * dt
        }
        // thẻ đúng rơi mất khỏi màn hình mà chưa chém
        const t = flyers.current.find((f) => f.kind === 'target')
        if (t && t.state === 'fly' && t.vy > 0 && t.y > H + t.h && !resolved.current) {
          resolved.current = true
          apiRef.current.miss({ item: t.item, label: '💨 Lọt mất!', x: t.x, y: H - 60 })
          setReveal(t.text)
          setTimeout(() => nextRef.current(), 1100)
        }
        const now2 = performance.now()
        trail.current = trail.current.filter((q) => now2 - q.t < 180)
        setTick((x) => x + 1)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const nextRound = () => {
    if (round + 1 >= targets.length) apiRef.current.end()
    else setRound((r) => r + 1)
  }
  // giữ nextRound mới nhất cho vòng lặp
  const nextRef = useRef(nextRound)
  nextRef.current = nextRound

  const local = (e: React.PointerEvent): Pt => {
    const r = fieldRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const slice = (a: Pt, b: Pt) => {
    if (!api.running || strokeUsed.current) return
    for (const f of flyers.current) {
      if (f.state !== 'fly') continue
      const box = { left: f.x - f.w / 2, right: f.x + f.w / 2, top: f.y - f.h / 2, bottom: f.y + f.h / 2 }
      if (!segmentHitsRect(a, b, box)) continue
      strokeUsed.current = true
      f.cutAngle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
      if (f.kind === 'target') {
        f.state = 'cut'
        sfx('slice')
        if (!resolved.current) {
          resolved.current = true
          api.hit({ item: target, points: 15, x: f.x, y: f.y })
          speak(target.en)
          setTimeout(() => nextRef.current(), 900)
        }
      } else {
        const bomb = f.kind === 'bomb'
        f.state = bomb ? 'boom' : 'cut'
        if (!bomb) sfx('slice')
        api.miss({ item: target, label: bomb ? '💣 Sai ngữ pháp!' : 'Nhầm câu!', x: f.x, y: f.y, sound: bomb ? 'boom' : 'bad' })
        setReveal(target.en)
      }
      return
    }
  }

  const onDown = (e: React.PointerEvent) => {
    drawing.current = true
    strokeUsed.current = false
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    trail.current = [{ ...local(e), t: performance.now() }]
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const pt = { ...local(e), t: performance.now() }
    const prev = trail.current[trail.current.length - 1]
    trail.current.push(pt)
    if (prev) slice(prev, pt)
  }
  const onUp = () => { drawing.current = false }

  if (!target) return null
  const trailPts = trail.current.map((q) => `${q.x},${q.y}`).join(' ')
  return (
    <div ref={fieldRef} className="ninja-field" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <div className="arcade-prompt swap" key={round}>
        <div className="label">Đợt {round + 1}/{targets.length} · chém câu có nghĩa là</div>
        <div className="big">{target.vi}</div>
        {reveal && <div className="ninja-reveal" lang="en">✓ {reveal}</div>}
      </div>
      {flyers.current.map((f) => (
        <div key={f.id} className={`flyer ${f.state} ${f.state !== 'fly' ? f.kind : ''}`} lang="en"
          style={{ width: f.w, left: f.x, top: f.y, transform: `translate(-50%, -50%) rotate(${f.rot}deg)`, ['--cut' as string]: `${f.cutAngle}deg` }}>
          {f.state === 'boom' ? (
            <span className="flyer-boom">💥</span>
          ) : f.state === 'cut' ? (
            <>
              <span className="half a">{f.text}</span>
              <span className="half b" aria-hidden>{f.text}</span>
            </>
          ) : (
            <span className="flyer-text">{f.text}</span>
          )}
        </div>
      ))}
      <svg className="blade" aria-hidden>
        {trailPts && <polyline points={trailPts} />}
      </svg>
    </div>
  )
}
