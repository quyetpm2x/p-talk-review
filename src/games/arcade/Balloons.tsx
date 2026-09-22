import { useEffect, useMemo, useRef, useState } from 'react'
import type { CustomGameProps } from '../types'
import { ArcadeShell, type ArcadeApi } from './ArcadeShell'
import { distractors, pickItems, type Item } from '../../lib/picker'
import { shuffle } from '../../lib/shuffle'
import { levelSpeed } from '../../lib/arcade'
import { sfx } from '../../lib/sfx'
import { speak } from '../../lib/speech'
import { useProgress } from '../../lib/ProgressContext'

const ROUNDS = 15
const BASE_MS = 7000 // thời gian bóng bay hết màn hình ở cấp 0
const COLORS = ['gold', 'navy', 'cream']

type Balloon = { id: string; item: Item; lane: number; delay: number; color: string; state: 'fly' | 'pop' | 'deflate' }

export function Balloons(props: CustomGameProps) {
  return (
    <ArcadeShell {...props} hint={<>Đọc nghĩa tiếng Việt ở trên,<br />chạm <b>quả bóng</b> có câu tiếng Anh đúng!</>}>
      {(api) => <Field api={api} {...props} />}
    </ArcadeShell>
  )
}

function Field({ api, lesson, items, pool }: CustomGameProps & { api: ArcadeApi }) {
  const [p] = useProgress()
  const targets = useMemo(() => pickItems(items, p.phrases, lesson.id, ROUNDS, Date.now()), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [round, setRound] = useState(0)
  const target = targets[round]
  const duration = BASE_MS / levelSpeed(api.level)
  const [wave, setWave] = useState(0)
  const resolved = useRef(false)

  const balloons = useMemo<Balloon[]>(() => {
    if (!target) return []
    const opts = shuffle([target, ...distractors(target, pool, 2, (i) => i.en)])
    const lanes = shuffle([0, 1, 2])
    return opts.map((item, k) => ({
      id: `${round}-${item.id}`, item, lane: lanes[k], delay: k * 450 + Math.random() * 300,
      color: COLORS[(round + k) % COLORS.length], state: 'fly',
    }))
  }, [round, target, pool])
  const [states, setStates] = useState<Record<string, Balloon['state']>>({})

  useEffect(() => { resolved.current = false; setStates({}) }, [round])

  const next = () => {
    if (round + 1 >= targets.length) api.end()
    else { setRound((r) => r + 1); setWave((w) => w + 1) }
  }

  const tap = (b: Balloon, e: React.PointerEvent) => {
    if (!api.running || resolved.current || states[b.id]) return
    const stage = (e.currentTarget as HTMLElement).closest('.arcade-field')!.getBoundingClientRect()
    const x = e.clientX - stage.left, y = e.clientY - stage.top
    if (b.item.id === target.id) {
      resolved.current = true
      sfx('pop')
      setStates((s) => ({ ...s, [b.id]: 'pop' }))
      api.hit({ item: target, points: 10, x, y, silent: true })
      speak(target.en)
      setTimeout(next, 650)
    } else {
      setStates((s) => ({ ...s, [b.id]: 'deflate' }))
      api.miss({ item: target, x, y })
    }
  }

  const escaped = (b: Balloon) => {
    if (b.item.id !== target.id || resolved.current || states[b.id]) return
    resolved.current = true
    api.miss({ item: target, label: '💨 Bay mất!', x: laneX(b.lane), y: 90 })
    setTimeout(next, 500)
  }

  if (!target) return null
  return (
    <>
      <div className="arcade-prompt swap" key={round}>
        <div className="label">Câu {round + 1}/{targets.length} · chạm bóng có nghĩa là</div>
        <div className="big">{target.vi}</div>
      </div>
      {balloons.map((b) => {
        const st = states[b.id] ?? 'fly'
        return (
          <div key={`${wave}-${b.id}`} className={`balloon-track lane-${b.lane}`}
            style={{ animationDuration: `${duration}ms`, animationDelay: `${b.delay}ms` }}
            onAnimationEnd={(e) => e.target === e.currentTarget && escaped(b)}>
            <button className={`balloon ${b.color} ${st}`} lang="en" onPointerDown={(e) => tap(b, e)} disabled={st !== 'fly'}>
              <span className="balloon-text">{b.item.en}</span>
              <span className="balloon-knot" aria-hidden />
            </button>
            <span className={`balloon-string ${st !== 'fly' ? 'gone' : ''}`} aria-hidden />
          </div>
        )
      })}
      <div className="clouds" aria-hidden />
    </>
  )
}

const laneX = (lane: number) => {
  const w = document.querySelector('.arcade-field')?.clientWidth ?? 360
  return w * (lane + 0.5) / 3
}
