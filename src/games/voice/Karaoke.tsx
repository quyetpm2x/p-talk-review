import { useEffect, useMemo, useRef, useState } from 'react'
import type { CustomGameProps } from '../types'
import type { Item } from '../../lib/picker'
import { pickItems } from '../../lib/picker'
import { useProgress } from '../../lib/ProgressContext'
import { speakWithProgress, stopSpeaking, hasTTS } from '../../lib/speech'
import { hasRecognition, type ListenError } from '../../lib/recognition'
import { listenSafe } from './listenSafe'
import { matchRatio, matchedWords } from '../../lib/scoring'
import { sfx } from '../../lib/sfx'
import { celebrate } from '../../lib/fx'
import { buzz } from '../../lib/haptics'
import { MicButton } from '../../components/MicButton'
import { karaokeAt, karaokeLines, sentenceTimeline, tokenOffsets, wordAtChar, type KaraokeLine } from './timing'
import { Waveform } from './Waveform'
import './voice.css'

const ROUNDS = 8
const PASS = 0.8
const MAX_TRIES = 2

const ERR: Record<ListenError, string> = {
  unsupported: 'Trình duyệt này chưa hỗ trợ nhận diện giọng nói.',
  denied: 'Chưa được cấp quyền micro.',
  'no-speech': 'Không nghe thấy gì — thử nói to và rõ hơn nhé.',
  network: 'Cần kết nối mạng để nhận diện giọng nói.',
  aborted: 'Đã dừng nghe.',
}

type Outcome = { passed: boolean; ratio: number; self: boolean; points: number }

export function Karaoke({ lesson, items, record, finish }: CustomGameProps) {
  const [p] = useProgress()
  const [lines] = useState(() =>
    karaokeLines(lesson, pickItems(items, p.phrases, lesson.id, items.length, Date.now()), ROUNDS))
  const [round, setRound] = useState(0)
  const [score, setScore] = useState(0)
  const [slow, setSlow] = useState(false)
  const answers = useRef<{ item: Item; correct: boolean }[]>([])
  const scoreRef = useRef(0)
  const startedAt = useRef(Date.now())

  useEffect(() => () => stopSpeaking(), [])

  const done = (line: KaraokeLine, o: Outcome) => {
    answers.current.push({ item: line.item, correct: o.passed })
    // Chỉ lưu Leitner cho cụm toolkit thật, không lưu câu hội thoại tạm
    if (line.phrase) record(line.item.id, o.passed)
    scoreRef.current += o.points
    setScore(scoreRef.current)
  }

  const next = () => {
    stopSpeaking()
    if (round + 1 < lines.length) return setRound(round + 1)
    const a = answers.current
    finish({
      score: scoreRef.current,
      correct: a.filter((x) => x.correct).length,
      total: a.length,
      wrong: a.filter((x) => !x.correct).map((x) => x.item),
      answers: a,
      seconds: Math.round((Date.now() - startedAt.current) / 1000),
    })
  }

  const line = lines[round]
  if (!line) return <div className="card center">Bài này chưa có câu nào để hát theo.</div>
  return (
    <div className="stack kk" style={{ gap: 14 }}>
      <div className="row kk-head">
        <span className="label">Câu {round + 1}/{lines.length}</span>
        <span className="tag">{line.phrase ? '🧰 Cụm toolkit' : '💬 Hội thoại mẫu'}</span>
        <span className="grow" />
        <span className="score-pill" key={score}>{score}</span>
      </div>
      <div className="kk-progress" aria-hidden><span style={{ width: `${(round / lines.length) * 100}%` }} /></div>
      <Round key={round} line={line} slow={slow} setSlow={setSlow} last={round + 1 >= lines.length}
        onResult={(o) => done(line, o)} onNext={next} />
    </div>
  )
}

function Round({ line, slow, setSlow, last, onResult, onNext }: {
  line: KaraokeLine
  slow: boolean
  setSlow: (s: boolean) => void
  last: boolean
  onResult: (o: Outcome) => void
  onNext: () => void
}) {
  const { tokens, spans, gaps } = useMemo(() => sentenceTimeline(line.text), [line.text])
  const [playing, setPlaying] = useState(false)
  const [played, setPlayed] = useState(false)
  const [k, setK] = useState({ done: 0, now: -1 })
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState<string | null>(null)
  const [ratio, setRatio] = useState(0)
  const [tries, setTries] = useState(0)
  const [err, setErr] = useState<ListenError | null>(null)
  const [out, setOut] = useState<Outcome | null>(null)
  const token = useRef(0)
  const touched = useRef(false) // đã bấm micro / tự chấm → không tự phát nữa
  const barRef = useRef<HTMLSpanElement>(null)
  const stopRef = useRef<() => void>()
  const selfMode = !hasRecognition() || err === 'unsupported' || err === 'denied' || err === 'network'

  const setBar = (f: number) => { if (barRef.current) barRef.current.style.transform = `scaleX(${Math.max(0, Math.min(1, f))})` }

  const play = () => {
    if (playing) { token.current++; stopSpeaking(); setPlaying(false); return }
    if (listening) return
    stopRef.current?.()
    const tok = ++token.current
    setPlaying(true)
    setK({ done: 0, now: -1 })
    setBar(0)
    speakWithProgress(line.text, { kokoro: line.kokoro, slow }, (pr) => {
      if (tok !== token.current) return
      let st: { done: number; now: number }
      if (pr.kind === 'time') {
        st = karaokeAt(spans, pr.fraction)
        setBar(pr.fraction)
      } else {
        const w = wordAtChar(tokenOffsets(pr.text, tokens), pr.charIndex)
        st = { done: w, now: w }
        setBar(spans[w]?.end ?? 1)
      }
      setK((prev) => (prev.done === st.done && prev.now === st.now ? prev : st))
    }).finally(() => {
      if (tok !== token.current) return
      setPlaying(false)
      setPlayed(true)
      setK({ done: tokens.length, now: -1 })
      setBar(1)
    })
  }

  // Tự phát câu khi vào lượt mới (chờ màn splash tắt; bỏ qua nếu người học đã bấm micro)
  useEffect(() => {
    let t = 0
    const tryPlay = () => {
      const splash = document.getElementById('splash')
      if (splash && !splash.classList.contains('hide')) { t = window.setTimeout(tryPlay, 300); return }
      if (hasTTS() && !touched.current) play()
    }
    t = window.setTimeout(tryPlay, 450)
    return () => { clearTimeout(t); token.current++; stopSpeaking(); stopRef.current?.() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const resolve = (passed: boolean, r: number, self: boolean) => {
    if (out) return
    touched.current = true
    const points = passed ? (self ? 10 : r >= 0.95 ? 25 : 20) : 0
    const o = { passed, ratio: r, self, points }
    setOut(o)
    onResult(o)
    buzz(passed)
    if (passed) { sfx('win'); celebrate() } else sfx('bad')
  }

  const startMic = () => {
    if (listening) return stopRef.current?.()
    if (out) return
    touched.current = true
    token.current++
    stopSpeaking()
    setPlaying(false)
    setErr(null)
    const { promise, stop } = listenSafe(12000)
    stopRef.current = stop
    setListening(true)
    promise
      .then((alts) => {
        const best = alts.reduce(
          (b, a) => { const r = matchRatio(line.text, a); return r > b.r ? { a, r } : b },
          { a: alts[0] ?? '', r: -1 },
        )
        const n = tries + 1
        setTries(n)
        setHeard(best.a)
        setRatio(Math.max(0, best.r))
        if (best.r >= PASS) resolve(true, best.r, false)
        else if (n >= MAX_TRIES) resolve(false, Math.max(0, best.r), false)
        else { sfx('bad'); buzz(false) }
      })
      .catch((e: ListenError) => setErr(e))
      .finally(() => setListening(false))
  }

  const marks = heard !== null ? matchedWords(line.text, heard) : null
  const wordClass = (i: number) => {
    if (marks && !playing) return marks[i] ? 'kw ok' : 'kw miss'
    if (i < k.done) return 'kw done'
    if (i === k.now) return 'kw now'
    return 'kw'
  }
  const long = line.text.length > 60

  return (
    <>
      <div className="kk-stage">
        <div className="kk-source small">{line.source}</div>
        <p className={`kk-line ${long ? 'long' : ''}`} lang="en" aria-live="off">
          {tokens.map((w, i) => <span key={i} className={wordClass(i)}>{w}{gaps[i] ? ` ${gaps[i]}` : ''}</span>)}
        </p>
        {line.phrase && <div className="kk-vi">{line.item.vi}</div>}
        <Waveform mode={listening ? 'listen' : playing ? 'play' : 'idle'} speaking={k.now >= 0} />
        <div className="kk-track" aria-hidden><span ref={barRef} /></div>
      </div>

      <div className="kk-controls">
        {hasTTS() && (
          <button type="button" className={`kk-play ${playing ? 'on' : ''}`} onClick={play}
            aria-label={playing ? 'Dừng' : 'Nghe câu mẫu'}>
            {playing ? '■' : '▶'}
          </button>
        )}
        <button type="button" className={`chip kk-slow ${slow ? 'sel' : ''}`} aria-pressed={slow}
          onClick={() => setSlow(!slow)}>🐢 Nghe chậm 0.75×</button>
      </div>

      {!out && !selfMode && (
        <div className="stack center kk-mic" style={{ gap: 8 }}>
          <div className="label">{played ? 'Đến lượt bạn — nhại lại y hệt!' : 'Nghe xong rồi nói theo'}</div>
          <MicButton listening={listening} onClick={startMic} />
          <div className="muted small">
            {listening ? 'Đang nghe… nói xong sẽ tự dừng'
              : heard !== null ? `Khớp ${Math.round(ratio * 100)}% — chưa đạt ${PASS * 100}%, thử lại (còn ${MAX_TRIES - tries} lượt)`
                : 'Bấm micro rồi đọc to câu trên'}
          </div>
          {err && <div className="small" style={{ color: 'var(--bad)' }}>{ERR[err]}</div>}
          <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'center' }}
            onClick={() => resolve(false, ratio, false)}>Bỏ qua</button>
        </div>
      )}

      {!out && selfMode && (
        <div className="card stack" style={{ gap: 10 }}>
          <div className="small">
            {err ? ERR[err] : ERR.unsupported} Hãy <strong>đọc to theo</strong> câu trên (bấm ▶ để nghe lại), rồi tự chấm:
          </div>
          <div className="grid-2">
            <button type="button" className="btn btn-ghost" onClick={() => resolve(false, 0, true)}>Chưa đạt</button>
            <button type="button" className="btn btn-primary" onClick={() => resolve(true, 1, true)}>Mình nói đúng</button>
          </div>
        </div>
      )}

      {out && (
        <div className={`feedback ${out.passed ? 'ok' : 'bad'} kk-result`}>
          <div>
            <strong>{out.passed ? (out.ratio >= 0.95 && !out.self ? '🌟 Hoàn hảo!' : '🎉 Tuyệt vời!') : '💪 Chưa đạt — nghe lại nhé'}</strong>
            {!out.self && heard !== null && <> · khớp {Math.round(out.ratio * 100)}%</>}
            {out.points > 0 && <> · +{out.points} điểm</>}
          </div>
          {heard !== null && <div className="small">Máy nghe được: <em lang="en">“{heard}”</em></div>}
          <button type="button" className="btn btn-primary btn-block" onClick={onNext}>{last ? 'Xem kết quả' : 'Câu tiếp →'}</button>
        </div>
      )}
    </>
  )
}
