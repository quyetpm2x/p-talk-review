import { useMemo, useRef, useState } from 'react'
import type { CustomGameProps } from '../types'
import { ArcadeShell, type ArcadeApi } from './ArcadeShell'
import { pickItems, type Item } from '../../lib/picker'
import { levelSpeed } from '../../lib/arcade'
import { sfx } from '../../lib/sfx'
import { speak } from '../../lib/speech'
import { useProgress } from '../../lib/ProgressContext'

const MAX_DROPS = 20
const BASE_MS = 8000 // thời gian rơi hết màn hình ở cấp 0

type Phase = 'fall' | 'catch' | 'wrong' | 'crash'

export function Rain(props: CustomGameProps) {
  return (
    <ArcadeShell {...props} hint={<>Cụm từ rơi xuống — chạm <b>giỏ nhóm</b> đúng<br />trước khi nó chạm đất!</>}>
      {(api) => <Field api={api} {...props} />}
    </ArcadeShell>
  )
}

function Field({ api, lesson, items }: CustomGameProps & { api: ArcadeApi }) {
  const [p] = useProgress()
  const groups = useMemo(() => [...lesson.groups].sort((a, b) => a.order - b.order), [lesson])
  const drops = useMemo(() => {
    // lặp lại danh sách nếu bộ cụm ít hơn số thẻ
    const base = pickItems(items, p.phrases, lesson.id, items.length, Date.now())
    return Array.from({ length: Math.min(MAX_DROPS, Math.max(base.length, 10)) }, (_, i) => base[i % base.length])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [n, setN] = useState(0)
  const [phase, setPhase] = useState<Phase>('fall')
  const [picked, setPicked] = useState<string | null>(null)
  const [bounce, setBounce] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const drop: Item | undefined = drops[n]
  const duration = BASE_MS / levelSpeed(api.level)

  const next = (delay: number) =>
    setTimeout(() => {
      if (n + 1 >= drops.length) return api.end()
      setN((x) => x + 1)
      setPhase('fall')
      setPicked(null)
    }, delay)

  // vị trí hiện tại của thẻ trong sân (để thẻ bay từ đúng chỗ vào giỏ)
  const cardPos = () => {
    const field = cardRef.current?.closest('.arcade-field')?.getBoundingClientRect()
    const r = cardRef.current?.getBoundingClientRect()
    if (!field || !r) return { x: 0, y: 0 }
    return { x: r.left - field.left + r.width / 2, y: r.top - field.top + r.height / 2 }
  }

  const choose = (gid: string, e: React.PointerEvent) => {
    if (!api.running || phase !== 'fall' || !drop) return
    setPicked(gid)
    const field = (e.currentTarget as HTMLElement).closest('.arcade-field')!.getBoundingClientRect()
    const bx = e.clientX - field.left, by = e.clientY - field.top
    const pos = cardPos()
    const card = cardRef.current
    if (card) {
      // thẻ bay từ vị trí hiện tại tới giỏ vừa chạm
      card.style.setProperty('--from-y', `${pos.y}px`)
      card.style.setProperty('--dx', `${bx - pos.x}px`)
      card.style.setProperty('--dy', `${by - pos.y}px`)
    }
    if (gid === drop.group) {
      setPhase('catch')
      setBounce(gid)
      sfx('whoosh')
      api.hit({ item: drop, points: 10, x: bx, y: by - 40 })
      speak(drop.en)
      setTimeout(() => setBounce(null), 500)
      next(450)
    } else {
      setPhase('wrong')
      api.miss({ item: drop, x: bx, y: by - 40 })
      next(1300)
    }
  }

  const crashed = () => {
    if (phase !== 'fall' || !drop) return
    const pos = cardPos()
    cardRef.current?.style.setProperty('--from-y', `${pos.y}px`)
    setPhase('crash')
    api.miss({ item: drop, label: '💥 Rơi mất!', x: pos.x, y: pos.y - 20 })
    next(1100)
  }

  if (!drop) return null
  const right = groups.find((g) => g.id === drop.group)
  return (
    <>
      <div className="rain-lines" aria-hidden />
      <div className="rain-counter">{n + 1}/{drops.length}</div>
      <div key={n} ref={cardRef} className={`rain-card ${phase}`} lang="en"
        style={phase === 'fall' ? { animationDuration: `${duration}ms` } : undefined}
        onAnimationEnd={(e) => e.animationName === 'rainFall' && crashed()}>
        <div className="rain-en">{drop.en}</div>
        <div className="rain-vi">{drop.vi}</div>
      </div>
      {phase === 'wrong' && right && <div className="rain-tip">Đúng là: {right.icon} {right.vi}</div>}
      <div className="baskets">
        {groups.map((g) => {
          const cls = [
            'basket',
            bounce === g.id ? 'bounce' : '',
            phase === 'wrong' && picked === g.id ? 'bad' : '',
            phase === 'wrong' && g.id === drop.group ? 'hint' : '',
          ].join(' ')
          return (
            <button key={g.id} className={cls} onPointerDown={(e) => choose(g.id, e)} aria-label={g.vi}>
              <span className="basket-icon" aria-hidden>{g.icon}</span>
              <span className="basket-name">{g.vi}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}
