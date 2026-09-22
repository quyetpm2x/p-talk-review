import { useEffect, useMemo, useRef, useState } from 'react'
import type { CustomGameProps } from '../types'
import type { Item } from '../../lib/picker'
import { shuffle } from '../../lib/shuffle'
import { speak, stopSpeaking } from '../../lib/speech'
import { matchRatio } from '../../lib/scoring'
import { hasRecognition, listen, type ListenError } from '../../lib/recognition'
import { sfx } from '../../lib/sfx'
import { burst } from '../../lib/fx'
import { buzz } from '../../lib/haptics'
import { SpeakButton } from '../../components/SpeakButton'
import { Icon } from '../../components/Icon'
import { findItem, getChat, sayable, PLAYER_VOICE, type ChatOption, type Line } from './data'
import './story.css'

type Msg =
  | { id: number; from: 'friend'; en: string; vi: string; time: string }
  | { id: number; from: 'me'; en: string; ok: boolean; voice: boolean; time: string }
  | { id: number; from: 'sys'; text: string; tone?: 'tip' | 'end' }

type Phase = 'intro' | 'bot' | 'await' | 'done'
/** Omit phân phối trên từng nhánh của union */
type NewMsg = Msg extends infer M ? (M extends Msg ? Omit<M, 'id'> : never) : never

const hhmm = () => new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
/** Bỏ dấu tiếng Việt để so với chữ nhận dạng giọng nói (Tuấn → Tuan). */
const plain = (s: string) => sayable(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
/** Thời gian “đang soạn tin” theo độ dài tin: 1–2 giây. */
const typingMs = (s: string) => Math.min(2000, 900 + s.length * 22)

/** 💬 Nhắn tin với bạn cũ: trả lời kịp giờ bằng gợi ý hoặc giọng nói. */
export function Chat({ lesson, record, finish }: CustomGameProps) {
  const chat = getChat(lesson.id)!
  const total = chat.seconds * 1000
  const [phase, setPhase] = useState<Phase>('intro')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [typing, setTyping] = useState(false)
  const [turnIdx, setTurnIdx] = useState(0)
  const [left, setLeft] = useState(total)
  const [showVi, setShowVi] = useState(true)
  const [listening, setListening] = useState(false)
  const [micBlocked, setMicBlocked] = useState<null | 'unsupported' | 'denied'>(hasRecognition() ? null : 'unsupported')
  const [micMsg, setMicMsg] = useState('')
  const [stat, setStat] = useState({ correct: 0, score: 0 })

  const alive = useRef(true)
  const phaseRef = useRef<Phase>('intro')
  const leftRef = useRef(total)
  const turnRef = useRef(0)
  const msgId = useRef(0)
  const answers = useRef<{ item: Item; correct: boolean }[]>([])
  const scoreRef = useRef(0)
  const startedAt = useRef(Date.now())
  const listenRef = useRef<{ stop: () => void } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const turn = chat.turns[turnIdx]
  const options = useMemo(() => shuffle(turn.options), [turn])

  const go = (p: Phase) => { phaseRef.current = p; setPhase(p) }
  const push = (m: NewMsg) => setMsgs((xs) => [...xs, { ...m, id: ++msgId.current } as Msg])

  useEffect(() => {
    alive.current = true // StrictMode chạy effect 2 lần
    return () => {
      alive.current = false
      stopSpeaking()
      listenRef.current?.stop()
    }
  }, [])

  // Luôn cuộn xuống tin mới nhất
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [msgs, typing, phase])

  const wait = (ms: number) => new Promise<void>((res, rej) => setTimeout(() => (alive.current ? res() : rej(new Error('unmounted'))), ms))

  /** Đọc to một tin nhắn, đợi đọc xong (rời trang giữa chừng → dừng chuỗi). */
  async function say(text: string, kokoro: string | undefined, voice: 'A' | 'B') {
    await wait(120) // để tiếng “pop/whoosh” vang trước
    await speak(sayable(text), { kokoro, voice })
    if (!alive.current) throw new Error('unmounted')
  }

  /** Bạn cũ gửi lần lượt từng tin, mỗi tin có “đang soạn tin…” trước. */
  async function friendSays(lines: Line[]) {
    for (const l of lines) {
      setTyping(true)
      await wait(typingMs(l.en))
      setTyping(false)
      push({ from: 'friend', en: l.en, vi: l.vi, time: hhmm() })
      sfx('pop')
      await say(l.en, chat.friend.voice, 'A')
      await wait(350)
    }
  }

  async function playTurn(i: number) {
    turnRef.current = i
    setTurnIdx(i)
    await friendSays(chat.turns[i].friend)
    leftRef.current = total
    setLeft(total)
    setMicMsg('')
    go('await')
  }

  const start = () => {
    startedAt.current = Date.now()
    go('bot')
    sfx('whoosh')
    playTurn(0).catch(() => {})
  }

  async function answer(opt: ChatOption | null, voice = false) {
    if (phaseRef.current !== 'await') return
    go('bot')
    listenRef.current?.stop()
    const t = chat.turns[turnRef.current]
    const good = t.options.find((o) => o.ok)!
    const ok = !!opt?.ok
    const secsLeft = leftRef.current / 1000

    // Lưu Leitner cho các cụm toolkit của gợi ý đúng
    const items = (good.toolkit ?? []).map((id) => findItem(lesson, id)).filter((x): x is Item => !!x)
    items.forEach((it) => record(it.id, ok))
    if (items[0]) answers.current.push({ item: items[0], correct: ok })
    if (ok) scoreRef.current += 10 + Math.ceil(secsLeft / 2) + (voice ? 5 : 0)
    setStat({ correct: answers.current.filter((a) => a.correct).length, score: scoreRef.current })

    if (opt) {
      push({ from: 'me', en: opt.en, ok, voice, time: hhmm() })
      sfx('whoosh')
    }
    buzz(ok)
    if (ok) {
      setTimeout(() => sfx('ok'), 250)
      const r = scrollRef.current?.getBoundingClientRect()
      if (r) burst(r.right - 60, r.bottom - 40, 18)
    } else sfx('bad')

    try {
      if (opt) await say(opt.en, PLAYER_VOICE, 'B')
      await wait(opt ? 400 : 200)
      if (!opt) await friendSays([chat.timeout])
      else await friendSays(ok ? t.replyOk : t.replyBad)
      if (!ok) push({ from: 'sys', tone: 'tip', text: `${opt ? `💡 ${opt.why ?? 'Chưa hợp tình huống.'} ` : '⏰ Hết giờ! '}Nên trả lời: “${good.en}”` })
      await wait(500)
      const nx = turnRef.current + 1
      if (nx < chat.turns.length) await playTurn(nx)
      else {
        await friendSays(chat.outro)
        push({ from: 'sys', tone: 'end', text: 'Cuộc trò chuyện đã kết thúc' })
        sfx(answers.current.filter((a) => a.correct).length >= Math.ceil(chat.turns.length * 0.7) ? 'win' : 'lose')
        go('done')
      }
    } catch { /* đã rời trang */ }
  }

  // Đồng hồ đếm ngược mỗi lượt (dừng khi đang nghe micro)
  useEffect(() => {
    if (phase !== 'await' || listening) return
    const t0 = Date.now()
    const base = leftRef.current
    let lastSec = Math.ceil(base / 1000)
    const id = setInterval(() => {
      const l = Math.max(0, base - (Date.now() - t0))
      leftRef.current = l
      setLeft(l)
      const sec = Math.ceil(l / 1000)
      if (sec !== lastSec) {
        lastSec = sec
        if (sec > 0 && sec <= 5) sfx('tick')
      }
      if (l <= 0) {
        clearInterval(id)
        answer(null)
      }
    }, 100)
    return () => clearInterval(id)
  }, [phase, listening]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMic = async () => {
    if (listening) { listenRef.current?.stop(); return }
    if (phaseRef.current !== 'await' || micBlocked) return
    setMicMsg('')
    setListening(true)
    const l = listen()
    listenRef.current = l
    try {
      const alts = await l.promise
      if (!alive.current || phaseRef.current !== 'await') return
      let best: { o: ChatOption | null; r: number } = { o: null, r: 0 }
      for (const o of options) for (const a of alts) {
        const r = matchRatio(plain(o.en), plain(a))
        if (r > best.r) best = { o, r }
      }
      setListening(false)
      if (best.o && best.r >= 0.6) answer(best.o, true)
      else setMicMsg(`Nghe được: “${alts[0] ?? ''}” — chưa khớp gợi ý nào (${Math.round(best.r * 100)}%). Nói lại hoặc chạm để chọn.`)
    } catch (e) {
      const err = e as ListenError
      if (err === 'denied' || err === 'unsupported') setMicBlocked(err)
      else if (err === 'no-speech') setMicMsg('Không nghe thấy gì — bấm 🎤 và nói lại nhé.')
      else if (err === 'network') setMicMsg('Lỗi mạng khi nhận giọng nói — hãy chạm để chọn.')
    } finally {
      if (alive.current) setListening(false)
      listenRef.current = null
    }
  }

  const showResult = () => {
      stopSpeaking()
    const a = answers.current
    const correct = a.filter((x) => x.correct).length
    finish({
      score: scoreRef.current,
      correct,
      total: a.length,
      wrong: a.filter((x) => !x.correct).map((x) => x.item),
      answers: a,
      seconds: Math.round((Date.now() - startedAt.current) / 1000),
    })
  }

  const pct = (left / total) * 100
  const secs = Math.ceil(left / 1000)

  return (
    <div className="chat">
      <div className="chat-head">
        <span className="chat-avatar" aria-hidden>{chat.friend.avatar}<i className="online-dot" /></span>
        <div className="grow chat-who">
          <b>{chat.friend.name}</b>
          <span className={`chat-status ${typing ? 'typing' : ''}`}>{typing ? 'đang soạn tin…' : 'Đang hoạt động'}</span>
        </div>
        <span className="chat-stat" aria-label={`Đúng ${stat.correct} trên ${chat.turns.length}`}>✓ {stat.correct}/{chat.turns.length}</span>
        <button className={`chat-vi-btn ${showVi ? 'on' : ''}`} onClick={() => setShowVi((v) => !v)} aria-pressed={showVi}
          aria-label={showVi ? 'Ẩn bản dịch' : 'Hiện bản dịch'}>VI</button>
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-day"><span>Hôm nay</span></div>
        {phase === 'intro' && (
          <div className="chat-sys">🔔 {chat.friend.name} vừa gửi cho bạn một tin nhắn</div>
        )}
        {msgs.map((m) =>
          m.from === 'sys' ? (
            <div key={m.id} className={`chat-sys ${m.tone ?? ''}`}>{m.text}</div>
          ) : m.from === 'friend' ? (
            <div key={m.id} className="msg-row left">
              <span className="msg-ava" aria-hidden>{chat.friend.avatar}</span>
              <div className="msg friend">
                <div className="msg-en">{m.en}</div>
                {showVi && <div className="msg-vi">{m.vi}</div>}
                <div className="msg-meta"><span>{m.time}</span></div>
              </div>
              <SpeakButton text={sayable(m.en)} size="sm" kokoro={chat.friend.voice} voice="A" />
            </div>
          ) : (
            <div key={m.id} className="msg-row right">
              <span className={`msg-mark ${m.ok ? 'ok' : 'bad'}`} aria-label={m.ok ? 'Hợp tình huống' : 'Chưa hợp'}>{m.ok ? '✓' : '✕'}</span>
              <div className={`msg me ${m.ok ? 'ok' : 'bad'}`}>
                <div className="msg-en">{m.voice && <span aria-label="đã nói">🎤 </span>}{m.en}</div>
                <div className="msg-meta"><span>{m.time}</span><span className="ticks" aria-label="Đã xem">✓✓</span></div>
              </div>
            </div>
          ),
        )}
        {typing && (
          <div className="msg-row left">
            <span className="msg-ava" aria-hidden>{chat.friend.avatar}</span>
            <div className="msg friend typing-bubble" aria-label="đang soạn tin"><i /><i /><i /></div>
          </div>
        )}
      </div>

      <div className="chat-dock">
        {phase === 'intro' && (
          <div className="stack chat-intro">
            <div className="small">
              💬 Bạn cũ <b>{chat.friend.name}</b> vừa nhắn cho bạn sau nhiều năm! Mỗi lượt có <b>{chat.seconds} giây</b> để trả lời — chạm một gợi ý
              {micBlocked ? '' : ' hoặc bấm 🎤 và đọc to câu đó'}.
            </div>
            <button className="btn btn-primary btn-block" onClick={start}>Mở tin nhắn</button>
          </div>
        )}

        {phase === 'await' && (
          <>
            <div className="chat-timer">
              <div className={`chat-timer-bar ${secs <= 5 ? 'hurry' : ''}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="row chat-timer-row">
              <span className="q-label grow">Chọn câu trả lời{listening ? ' — đang nghe…' : ''}</span>
              <span className={`chat-secs ${secs <= 5 ? 'hurry' : ''}`}>⏱ {secs}s</span>
            </div>
            <div className="chat-opts">
              {options.map((o) => (
                <button key={o.en} className="chat-opt" onClick={() => answer(o)}>{o.en}</button>
              ))}
            </div>
            <div className="chat-compose">
              {micBlocked ? (
                <span className="chat-mic-note small muted">
                  🎤 {micBlocked === 'denied' ? 'Micro bị chặn — hãy chạm gợi ý để trả lời.' : 'Trình duyệt này chưa hỗ trợ nói — hãy chạm gợi ý để trả lời.'}
                </span>
              ) : (
                <>
                  <button className={`chat-mic ${listening ? 'on' : ''}`} onClick={toggleMic} aria-label={listening ? 'Dừng nghe' : 'Bấm để nói'}>
                    <Icon name={listening ? 'stop' : 'mic'} size={22} />
                  </button>
                  <span className="chat-fake-input">{micMsg || (listening ? 'Đang nghe… đọc to một gợi ý' : 'Bấm 🎤 và đọc to một gợi ý…')}</span>
                </>
              )}
            </div>
          </>
        )}

        {phase === 'bot' && (
          <div className="chat-compose">
            <span className="chat-fake-input muted">{typing ? `${chat.friend.name} đang soạn tin…` : 'Đã gửi'}</span>
          </div>
        )}

        {phase === 'done' && (
          <div className="stack chat-done">
            <div className="row">
              <span className="chat-done-icon">{stat.correct >= Math.ceil(chat.turns.length * 0.7) ? '🎉' : '💪'}</span>
              <div className="grow">
                <b>Trả lời hợp {stat.correct}/{chat.turns.length} tin</b>
                <div className="small muted">{stat.score} điểm · trả lời nhanh và nói bằng giọng được cộng thêm</div>
              </div>
            </div>
            <button className="btn btn-primary btn-block" onClick={showResult}>Xem kết quả</button>
          </div>
        )}
      </div>
    </div>
  )
}
