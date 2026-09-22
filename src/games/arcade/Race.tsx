import { useEffect, useMemo, useRef, useState } from 'react'
import type { CustomGameProps } from '../types'
import { ArcadeShell, type ArcadeApi } from './ArcadeShell'
import { distractors, pickItems, type Item } from '../../lib/picker'
import { shuffle } from '../../lib/shuffle'
import { ghostFinishMs, ghostSteps } from '../../lib/arcade'
import { sfx } from '../../lib/sfx'
import { speak } from '../../lib/speech'
import { celebrate } from '../../lib/fx'
import { RaceCar } from './RaceCar'
import { useProgress } from '../../lib/ProgressContext'

const TRACK = 10 // số câu đúng để về đích
const FIRST_STEP_MS = 10000 // chưa có kỷ lục: bước đầu của xe ma mất 10 giây
const GHOST_ACCEL = 0.88 // mỗi bước sau ngắn hơn 12% → xe ma nhanh dần, về đích sau ~60s
const STUN_MS = 1200

export function Race(props: CustomGameProps) {
  return (
    <ArcadeShell {...props} showLives={false}
      hint={<>Trả lời đúng để <b>tiến lên</b> 🔥, sai thì xe <b>quay đầu lùi lại</b>.<br />Về đích trước <b>xe ma 👻</b>!</>}>
      {(api) => <Field api={api} {...props} />}
    </ArcadeShell>
  )
}

function Field({ api, lesson, items, pool }: CustomGameProps & { api: ArcadeApi }) {
  const [p, update] = useProgress()
  const bestKey = `${lesson.id}:race:bestMs`
  // Xe ma tiến từng bước theo thời gian (nhanh dần), không phụ thuộc câu trả lời của người chơi.
  // Có kỷ lục thì co giãn nhịp bước để xe ma về đích đúng bằng kỷ lục. Giữ nguyên suốt cuộc đua.
  const [{ firstStepMs, hasRecord }] = useState(() => {
    const best = p.bestScores[bestKey]
    const first = best ? (best / ghostFinishMs(1, TRACK, GHOST_ACCEL)) : FIRST_STEP_MS
    return { firstStepMs: first, hasRecord: best !== undefined }
  })
  const ghostMs = ghostFinishMs(firstStepMs, TRACK, GHOST_ACCEL) // thời điểm xe ma về đích
  const queue = useMemo(() => {
    const base = pickItems(items, p.phrases, lesson.id, items.length, Date.now())
    return Array.from({ length: 30 }, (_, i) => base[i % base.length])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [qi, setQi] = useState(0)
  const [pos, setPos] = useState(0) // số bước đã đi (đúng +1, sai −1)
  const [elapsed, setElapsed] = useState(0)
  const [car, setCar] = useState<'idle' | 'boost' | 'turn' | 'reverse'>('idle')
  // Sai: xe quay ngược và lùi 1 bước (ở vạch xuất phát thì đứng im), xe ma được thưởng 1 bước.
  // Đúng: quay đầu lên và tiến 1 bước. Không trừ mạng.
  const [facingBack, setFacingBack] = useState(false)
  const [ghostBonus, setGhostBonus] = useState(0) // số bước xe ma được thưởng khi mình trả lời sai
  const [picked, setPicked] = useState<number | null>(null)
  const [locked, setLocked] = useState(false)
  const [finished, setFinished] = useState(false)
  const apiRef = useRef(api)
  apiRef.current = api
  // không giới hạn số câu sai nên câu hỏi quay vòng
  const q: Item = queue[qi % queue.length]
  const opts = useMemo(() => shuffle([q, ...distractors(q, pool, 2, (i) => i.en)]), [q, pool])

  // Đồng hồ (dừng khi tạm dừng / về đích)
  useEffect(() => {
    let raf = 0, last = performance.now()
    const loop = (now: number) => {
      const dt = now - last
      last = now
      if (apiRef.current.running && !finished) setElapsed((e) => e + dt)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [finished])

  const answer = (i: number, e: React.PointerEvent) => {
    if (!api.running || locked || finished) return
    const field = (e.currentTarget as HTMLElement).closest('.arcade-field')!.getBoundingClientRect()
    const x = e.clientX - field.left, y = e.clientY - field.top
    setPicked(i)
    setLocked(true)
    if (opts[i] === q) {
      sfx('boost')
      setCar('boost')
      setFacingBack(false)
      api.hit({ item: q, points: 10, x, y: y - 30, silent: true })
      speak(q.en)
      const np = pos + 1
      setPos(np)
      if (np >= TRACK) {
        setFinished(true)
        const ms = Math.round(elapsed)
        // kỷ lục = thời gian về đích nhanh nhất (ghostMs chính là kỷ lục cũ khi đã có)
        if (!hasRecord || ms < ghostMs) update((pp) => ({ ...pp, bestScores: { ...pp.bestScores, [bestKey]: ms } }))
        if (gSteps < TRACK) { celebrate(); sfx('win') } else sfx('lose')
        setTimeout(() => api.end({ seconds: Math.round(ms / 1000) }), 1600)
        return
      }
      setTimeout(() => { setCar('idle'); setPicked(null); setLocked(false); setQi((x) => x + 1) }, 650)
    } else {
      setGhostBonus((g) => g + 1)
      if (pos > 0) {
        setFacingBack(true)
        setCar('reverse')
        setPos(pos - 1)
        // lùi về tới vạch xuất phát thì tự quay mũi lên sau khi lùi xong
        if (pos - 1 === 0) setTimeout(() => setFacingBack(false), 700)
        api.miss({ item: q, x, y: y - 30, label: '↩ lùi 1 bước · 👻 +1', loseLife: false })
      } else {
        // ở vạch xuất phát: xe đứng im (không quay, không lùi)
        api.miss({ item: q, x, y: y - 30, label: '👻 +1 bước', loseLife: false })
      }
      setTimeout(() => { setCar('idle'); setPicked(null); setLocked(false); setQi((x) => x + 1) }, STUN_MS)
    }
  }

  const me = pos / TRACK
  // xe ma = bước tự đi theo thời gian + bước thưởng khi mình sai
  const gSteps = Math.min(TRACK, ghostSteps(elapsed, firstStepMs, TRACK, GHOST_ACCEL) + ghostBonus)
  const ghost = gSteps / TRACK
  const ahead = pos >= gSteps
  let status = ahead ? 'Đang dẫn!' : 'Bị xe ma vượt!'
  if (!finished && gSteps >= TRACK) status = '👻 Xe ma về đích!'
  if (finished) {
    const won = gSteps < TRACK
    const newRecord = hasRecord && elapsed < ghostMs
    if (!won) status = '🏁 Về đích'
    else if (newRecord) status = '🏆 Phá kỷ lục!'
    else status = '🏆 Thắng xe ma!'
  }

  return (
    <div className="race">
      <div className="race-info">
        <div className="race-time">⏱ {(elapsed / 1000).toFixed(1)}s</div>
        <div className={`race-status ${ahead ? 'ok' : 'bad'}`}>{status}</div>
        <div className="race-progress">{pos}/{TRACK}</div>
      </div>
      <div className="road">
        <div className={`road-lines ${car === 'boost' ? 'fast' : ''}`} aria-hidden />
        <div className="finish-line" aria-hidden />
        <div className="lane lane-ghost">
          <div className="car ghost" style={{ bottom: `calc(${ghost * 100}% * 0.78 + 4%)` }} aria-label="Xe ma">
            <RaceCar body="#8fb3ff" accent="#e8f0ff" />
            <span className="car-tag">Xe ma</span>
          </div>
        </div>
        <div className="lane lane-me">
          <div className={`car me ${car} ${facingBack ? 'back' : ''}`} style={{ bottom: `calc(${me * 100}% * 0.78 + 4%)` }}
            aria-label={facingBack ? 'Xe của bạn (đang quay ngược)' : 'Xe của bạn'}>
            {car === 'boost' && <span className="nitro" aria-hidden>🔥</span>}
            {car === 'reverse' && <span className="dust" aria-hidden>💨</span>}
            <RaceCar body="#d4ad5e" accent="#fff4d6" />
            <span className="car-tag">Bạn</span>
          </div>
        </div>
      </div>

      <div className="race-panel">
        <div className="race-q"><span className="label">Nói bằng tiếng Anh</span><div className="big">{q.vi}</div></div>
        <div className="race-opts">
          {opts.map((o, i) => {
            const cls = picked === null ? '' : o === q ? 'ok' : i === picked ? 'bad' : 'dim'
            return (
              <button key={`${qi}-${i}`} className={`race-opt ${cls}`} lang="en" onPointerDown={(e) => answer(i, e)} disabled={locked}>
                {o.en}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
