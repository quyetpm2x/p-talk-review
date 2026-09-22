import { useRef, useState } from 'react'
import { hasRecognition, listen, type ListenError } from '../lib/recognition'
import { matchedWords, matchRatio, displayTokens } from '../lib/scoring'
import { MicButton } from './MicButton'
import { SpeakButton } from './SpeakButton'

export const PASS = 0.8

const ERR: Record<ListenError, string> = {
  unsupported: 'Trình duyệt này chưa hỗ trợ nhận diện giọng nói.',
  denied: 'Chưa được cấp quyền micro. Hãy cho phép micro trong cài đặt trình duyệt.',
  'no-speech': 'Không nghe thấy gì — thử nói to và rõ hơn nhé.',
  network: 'Cần kết nối mạng để nhận diện giọng nói.',
  aborted: 'Đã dừng nghe.',
}

/**
 * Cho người học nói một câu và chấm độ khớp.
 * onResult được gọi đúng một lần: khi đạt, khi hết lượt thử, hoặc khi tự chấm.
 */
export function SpeechCheck({ target, onResult, maxTries = 2, showTarget = true }: {
  target: string
  onResult: (r: { ratio: number; self?: boolean; passed: boolean }) => void
  maxTries?: number
  showTarget?: boolean
}) {
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState<string | null>(null)
  const [ratio, setRatio] = useState(0)
  const [tries, setTries] = useState(0)
  const [err, setErr] = useState<ListenError | null>(null)
  const [done, setDone] = useState(false)
  const stopRef = useRef<() => void>()
  const selfMode = !hasRecognition() || err === 'unsupported' || err === 'denied' || err === 'network'

  const finish = (r: { ratio: number; self?: boolean; passed: boolean }) => {
    if (done) return
    setDone(true)
    onResult(r)
  }

  const start = () => {
    if (listening) return stopRef.current?.()
    setErr(null)
    const { promise, stop } = listen()
    stopRef.current = stop
    setListening(true)
    promise
      .then((alts) => {
        const best = alts.reduce(
          (b, a) => { const r = matchRatio(target, a); return r > b.r ? { a, r } : b },
          { a: alts[0] ?? '', r: -1 },
        )
        const n = tries + 1
        setTries(n)
        setHeard(best.a)
        setRatio(best.r)
        if (best.r >= PASS || n >= maxTries) finish({ ratio: best.r, passed: best.r >= PASS })
      })
      .catch((e: ListenError) => setErr(e))
      .finally(() => setListening(false))
  }

  const marks = heard !== null ? matchedWords(target, heard) : null
  const tokens = displayTokens(target)

  return (
    <div className="stack" style={{ gap: 12 }}>
      {showTarget && marks && (
        <div className="card" lang="en" style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.5 }}>
          {tokens.map((w, i) => (
            <span key={i} className={marks[i] ? 'word-ok' : 'word-miss'}>{w} </span>
          ))}
        </div>
      )}
      {heard !== null && (
        <div className="small muted">
          Máy nghe được: <em lang="en">“{heard}”</em> · khớp <strong>{Math.round(ratio * 100)}%</strong>
        </div>
      )}
      {!selfMode && !done && (
        <div className="stack center" style={{ gap: 8 }}>
          <MicButton listening={listening} onClick={start} />
          <div className="muted small">
            {listening ? 'Đang nghe… nói xong sẽ tự dừng' : heard !== null ? `Chưa đạt ${PASS * 100}% — thử lại (còn ${maxTries - tries} lượt)` : 'Bấm micro rồi nói'}
          </div>
          {err && <div className="small" style={{ color: 'var(--bad)' }}>{ERR[err]}</div>}
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'center' }} onClick={() => finish({ ratio, passed: false })}>Bỏ qua</button>
        </div>
      )}
      {selfMode && !done && (
        <div className="card stack" style={{ gap: 10 }}>
          <div className="small">{err ? ERR[err] : ERR.unsupported} Hãy <strong>đọc to</strong>, nghe câu mẫu rồi tự chấm:</div>
          <div className="row">
            <div className="grow" lang="en" style={{ fontWeight: 600 }}>{target}</div>
            <SpeakButton text={target} />
          </div>
          <div className="grid-2">
            <button className="btn btn-ghost" onClick={() => finish({ ratio: 0, self: true, passed: false })}>Chưa đạt</button>
            <button className="btn btn-primary" onClick={() => finish({ ratio: 1, self: true, passed: true })}>Mình nói đúng</button>
          </div>
        </div>
      )}
    </div>
  )
}
