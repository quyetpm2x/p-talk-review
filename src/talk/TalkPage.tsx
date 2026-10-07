import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getLesson } from '../lessons'
import { getSession } from '../lib/auth'
import { ApiError } from '../lib/api'
import { hasRecognition, listen } from '../lib/recognition'
import { speak, speakWithProgress, stopSpeaking } from '../lib/speech'
import { sfx } from '../lib/sfx'
import { Mascot, type Mood } from '../motivation/Mascot'
import { useReward } from '../motivation/useReward'
import { RewardInline } from '../motivation/Reward'
import type { RewardReport } from '../motivation/engine'
import { isQuotaError, talkSummary, talkTurn, type TalkQuota, type TalkSummary, type TurnBody } from './api'
import { compareSaid, hints, historyFor, markPhrases, phrasesUsed, SentenceChunker, splitWords, wordProgress, type Turn } from './core'
import type { WordResult } from '../pron/core'
import { hapticListen, hapticSend, hapticWin } from '../lib/haptics'
import { currentTalkStreak, dayKey, recordTalkDay } from '../lib/progress'
import { GOALS, loadTalkSettings, saveTalkSettings, sessionGoal, SPEEDS, TOPICS } from './settings'
import { addWords } from './words'
import { useProgress } from '../lib/ProgressContext'
import { startCapture, toWav, type Capture } from '../pron/capture'
import { analyze } from '../pron/engine'
import { usePronDownload } from '../pron/model'
import { PronChip, PronSetting, PronSheet } from '../pron/PronPanel'
import './talk.css'

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking'

/** Luyện nói với Cú: /talk/:lessonId  (lessonId = 'free' → Trò chuyện tự do theo chủ đề). */
export function TalkPage() {
  const { lessonId = 'free' } = useParams()
  const navigate = useNavigate()
  const lesson = lessonId === 'free' ? undefined : getLesson(lessonId)
  const [prog, update] = useProgress()
  const give = useReward()
  const [settings, setSettings] = useState(loadTalkSettings)
  const [mode, setMode] = useState<'lesson' | 'free'>(lesson ? 'lesson' : 'free')
  const [topic, setTopic] = useState<string | null>(null) // null = chưa chọn (bài học: chọn chế độ; trang chủ: chọn chủ đề)
  const [turns, setTurns] = useState<Turn[]>([])
  const [phase, setPhase] = useState<Phase>('idle')
  const [partial, setPartial] = useState('')
  const [typing, setTyping] = useState(!hasRecognition())
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  /** Lượt đã dùng / hạn mức hôm nay; hết lượt → hiện thẻ "Cú hẹn bạn vào ngày mai" thay cho thanh micro */
  const [quota, setQuota] = useState<TalkQuota | null>(null)
  const [outOfTurns, setOutOfTurns] = useState(false)
  /** Mã buổi nói: máy chủ giữ cùng một nhà cung cấp AI cho cả buổi (Cú không đổi giọng giữa chừng) */
  const sessionId = useRef('')
  const [showVi, setShowVi] = useState<Set<number>>(new Set())
  const [replaying, setReplaying] = useState(false)
  /** Karaoke: Cú đang đọc tới đâu trong bong bóng `turn` (done = số từ đã đọc, now = từ đang đọc). */
  const [reading, setReading] = useState<{ turn: number; done: number; now: number } | null>(null)
  /** Cú đọc lại (Nói lại / Chậm hơn / câu sửa / từ mới). Có `turn` → tô từng từ trong bong bóng đó. */
  const replay = (text: string, rate = settings.speed, turn?: number) => {
    hush()
    const gen = speakGen.current
    setReplaying(true)
    const done = () => { if (gen === speakGen.current) { setReplaying(false); setReading(null) } }
    if (turn === undefined) { void speak(text, { rate }).finally(done); return }
    void speakWithProgress(text, { rate }, (p) => {
      if (gen !== speakGen.current) return
      const w = wordProgress(text, p)
      setReading((cur) => (cur && cur.turn === turn && cur.done === w.done && cur.now === w.now ? cur : { turn, ...w }))
    }).finally(done)
  }
  /** Mức âm lượng micro gần nhất (vẽ sóng âm trong bong bóng đang nghe) */
  const [levels, setLevels] = useState<number[]>([0, 0, 0, 0, 0])
  const lastLevelAt = useRef(0)
  const onLevel = useCallback((v: number) => {
    const now = performance.now()
    if (now - lastLevelAt.current < 50) return // ~20 lần/giây là đủ mượt
    lastLevelAt.current = now
    setLevels((ls) => [...ls.slice(1), v])
  }, [])
  const [holding, setHolding] = useState(false)
  /** Luyện nói lại câu đúng trên thẻ "Nói đúng hơn" — theo chỉ số bong bóng Cú */
  const [fixTry, setFixTry] = useState<Record<number, { status: 'listening' | 'done' | 'error'; heard?: string; cmp?: ReturnType<typeof compareSaid>; pron?: WordResult[]; msg?: string }>>({})
  /** Từ mới đang mở nghĩa: bong bóng `turn`, cụm thứ `w` */
  const [wordPop, setWordPop] = useState<{ turn: number; w: number } | null>(null)
  /** Cụm của bài vừa dùng đúng (hiện hiệu ứng trên thanh mục tiêu) */
  const [goalFlash, setGoalFlash] = useState<string | null>(null)
  /** Thẻ gợi ý đã chạm 1 lần (Cú đọc mẫu) — chạm lần 2 thì nghe học sinh nhại lại */
  const [armedHint, setArmedHint] = useState<string | null>(null)
  const [showHints, setShowHints] = useState(false)
  const [summary, setSummary] = useState<(TalkSummary & { turns: number; used: string[]; words: number }) | null>(null)
  const [reward, setReward] = useState<RewardReport | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [pronOpen, setPronOpen] = useState<number | null>(null)
  const pronReady = usePronDownload().status === 'ready'

  const ctx = useMemo(() => ({
    title: lesson?.title ?? 'Free conversation',
    titleVi: lesson?.titleVi ?? '',
    phrases: lesson ? lesson.phrases.slice(0, 8).map((p) => p.en) : [],
  }), [lesson])
  const topicEn = topic && topic !== 'lesson' ? TOPICS.find((t) => t.id === topic)?.en : undefined

  // ----- giọng gia sư: đọc từng câu ngay khi có, theo hàng đợi; có thể ngắt -----
  const speakChain = useRef<Promise<void>>(Promise.resolve())
  const speakGen = useRef(0)
  /** Xếp hàng đọc một câu của bong bóng `turn`; `base` = số từ đứng trước câu này trong bong bóng (để tô đúng vị trí). */
  const say = useCallback((sentence: string, turn: number, base: number) => {
    const gen = speakGen.current
    speakChain.current = speakChain.current.then(() => {
      if (gen !== speakGen.current) return
      return speakWithProgress(sentence, { rate: settings.speed }, (p) => {
        if (gen !== speakGen.current) return
        const w = wordProgress(sentence, p)
        const next = { turn, done: base + w.done, now: w.now < 0 ? -1 : base + w.now }
        setReading((cur) => (cur && cur.turn === next.turn && cur.done === next.done && cur.now === next.now ? cur : next))
      })
    })
  }, [settings.speed])
  const hush = useCallback(() => { speakGen.current++; stopSpeaking(); speakChain.current = Promise.resolve(); setReading(null) }, [])

  const abortRef = useRef<AbortController | null>(null)
  const stopListen = useRef<(() => void) | null>(null)
  const turnsRef = useRef(turns)
  turnsRef.current = turns
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }) }, [turns, partial])

  /** Gửi một lượt (text rỗng = gia sư mở đầu). */
  const send = useCallback(async (text: string) => {
    const session = getSession()
    if (!session) return
    setError('')
    hush()
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    const before = turnsRef.current
    const withStudent: Turn[] = text ? [...before, { role: 'student', text }] : before
    if (text) hapticSend()
    const tutorIdx = withStudent.length
    setTurns([...withStudent, { role: 'tutor', text: '' }])
    setPhase('thinking')
    let wordsQueued = 0
    const chunker = new SentenceChunker((sentence) => { const base = wordsQueued; wordsQueued += splitWords(sentence).length; say(sentence, tutorIdx, base) })
    const daily = topic === 'daily'
    const body: TurnBody = { mode, lesson: daily ? { ...ctx, phrases: [] } : ctx, topic: topicEn, history: historyFor(before), text, session: sessionId.current }
    try {
      const meta = await talkTurn(session.token, body, (t) => {
        setPhase('speaking')
        chunker.push(t)
        setTurns((ts) => ts.map((x, i) => (i === tutorIdx ? { ...x, text: x.text + t } : x)))
      }, ac.signal, (q) => { setQuota(q); if (q.used >= q.limit) setOutOfTurns(true) })
      chunker.end()
      setTurns((ts) => ts.map((x, i) => (i === tutorIdx ? { ...x, text: meta.reply || x.text, meta } : x)))
      // Từ mới + câu sửa tự vào Sổ từ ngay (không đợi kết thúc buổi)
      const items = [...meta.new_words, ...(meta.fix ? [{ en: meta.fix.better, vi: `Nói đúng hơn: “${meta.fix.said}”` }] : [])]
      if (items.length) update((p) => addWords(p, items, Date.now()))
      speakChain.current.then(() => { if (!ac.signal.aborted) { setPhase('idle'); setReading(null) } })
    } catch (e) {
      if (ac.signal.aborted) return
      setTurns((ts) => ts.filter((_, i) => i !== tutorIdx))
      if (isQuotaError(e)) setOutOfTurns(true)
      else setError(e instanceof ApiError ? e.message : 'Cú chưa nghe rõ, thử lại nhé')
      setPhase('idle')
    }
  }, [ctx, hush, mode, say, topic, topicEn])

  // Bắt đầu (và mỗi lần đổi chế độ / "Nói tiếp"): xoá hội thoại, gia sư chào trước
  const [sessionKey, setSessionKey] = useState(0)
  const restart = () => { abortRef.current?.abort(); hush(); turnsRef.current = []; setTurns([]); setSessionKey((k) => k + 1) }
  useEffect(() => {
    sessionId.current = Math.random().toString(36).slice(2, 12) + Date.now().toString(36)
    if (topic) void send('')
  }, [topic, sessionKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { abortRef.current?.abort(); stopListen.current?.(); stopSpeaking() }, [])

  /** Chấm phát âm câu vừa nói (chạy nền); gắn kết quả vào lượt của học sinh ở vị trí idx. */
  const scorePron = (cap: Capture, idx: number, text: string) => {
    const setPron = (pron: Turn['pron']) => setTurns((ts) => ts.map((x, i) => (i === idx && x.role === 'student' ? { ...x, pron } : x)))
    void cap.stop().then(async (pcm) => {
      if (pcm.length < 16000 * 0.4) return // quá ngắn
      const wavUrl = URL.createObjectURL(toWav(pcm))
      setPron({ status: 'pending', wavUrl, of: text })
      try { setPron({ status: 'done', wavUrl, of: text, words: (await analyze(pcm, text)).words }) } catch { setPron({ status: 'error', wavUrl, of: text }) }
    })
  }

  /**
   * Bắt đầu nghe.
   * - hold: giữ để nói — nghe tới khi thả nút (không tự dừng khi im lặng)
   * - tap: chạm một lần — tự gửi sau 1,5 giây im lặng
   * - expected: câu mẫu học sinh đang nhại (thẻ gợi ý) → chấm phát âm theo câu mẫu
   */
  const startListening = async (o: { hold: boolean; expected?: string }) => {
    if (phase === 'speaking' || phase === 'thinking') { abortRef.current?.abort(); hush() } // ngắt lời Cú
    setError('')
    setPartial('')
    setLevels([0, 0, 0, 0, 0])
    setHolding(o.hold)
    setPhase('listening')
    sfx('pop')
    hapticListen()
    if (!settings.onboarded) { const n = { ...settings, onboarded: true }; setSettings(n); saveTalkSettings(n) }
    // Chấm phát âm: thu âm song song với nhận giọng (chỉ khi đã bật + đã tải bộ chấm)
    const cap = settings.pron && pronReady ? await startCapture().catch(() => null) : null
    const l = listen({ hold: o.hold, silenceMs: 1500, onPartial: setPartial, onLevel })
    stopListen.current = l.stop
    l.promise.then((alts) => {
      setPartial('')
      setHolding(false)
      const idx = turnsRef.current.length
      void send(alts[0])
      if (cap) scorePron(cap, idx, o.expected ?? alts[0])
    }).catch((e) => {
      cap?.cancel()
      setPartial('')
      setHolding(false)
      setPhase('idle')
      if (e === 'denied' || e === 'unsupported') { setTyping(true); setError('Không dùng được micro — bạn gõ câu trả lời nhé') }
      else if (e === 'no-speech') setError(o.hold ? 'Cú chưa nghe thấy gì — giữ nút 🎤 rồi nói nhé' : 'Cú chưa nghe thấy gì, chạm 🎤 rồi nói nhé')
    })
  }

  // Nút micro: GIỮ ≥ 200ms = giữ để nói (thả là gửi) · CHẠM nhanh = nói rảnh tay · đang nghe mà chạm = dừng & gửi
  const press = useRef<{ timer: number; mode: 'pending' | 'hold' } | null>(null)
  const micDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (phase === 'listening') { stopListen.current?.(); press.current = null; return }
    const timer = window.setTimeout(() => {
      if (!press.current) return
      press.current.mode = 'hold'
      void startListening({ hold: true })
    }, 200)
    press.current = { timer, mode: 'pending' }
  }
  const micUp = () => {
    const p = press.current
    press.current = null
    if (!p) return
    clearTimeout(p.timer)
    if (p.mode === 'hold') stopListen.current?.() // thả tay → gửi ngay
    else void startListening({ hold: false }) // chạm nhanh → nói rảnh tay
  }
  /** Bàn phím / trình đọc màn hình (không có pointer): bấm = chạm nhanh */
  const micKey = (e: React.MouseEvent) => {
    if (e.detail !== 0) return
    if (phase === 'listening') stopListen.current?.()
    else void startListening({ hold: false })
  }

  /** 🎤 trên thẻ "Nói đúng hơn": lượt luyện riêng (không gửi Cú) — nghe, so từng từ, chấm phát âm nếu đã bật. */
  const practiceFix = async (turn: number, better: string) => {
    if (phase === 'listening' || Object.values(fixTry).some((f) => f.status === 'listening')) return
    hush()
    const set = (v: (typeof fixTry)[number]) => setFixTry((m) => ({ ...m, [turn]: v }))
    set({ status: 'listening' })
    sfx('pop')
    hapticListen()
    const cap = settings.pron && pronReady ? await startCapture().catch(() => null) : null
    const l = listen({ hold: false, silenceMs: 1500, onPartial: (h) => set({ status: 'listening', heard: h }), onLevel })
    stopListen.current = l.stop
    l.promise.then(async (alts) => {
      const cmp = compareSaid(alts[0], better)
      if (cmp.pass) hapticWin()
      sfx(cmp.pass ? 'ok' : 'bad')
      set({ status: 'done', heard: alts[0], cmp })
      if (cap) {
        const pcm = await cap.stop()
        if (pcm.length >= 16000 * 0.4) {
          try { const pr = await analyze(pcm, better); set({ status: 'done', heard: alts[0], cmp, pron: pr.words }) } catch { /* bỏ qua */ }
        }
      }
    }).catch((e) => {
      cap?.cancel()
      set({ status: 'error', msg: e === 'denied' || e === 'unsupported' ? 'Không dùng được micro' : 'Cú chưa nghe thấy — chạm 🎤 rồi đọc câu đúng nhé' })
    })
  }

  /** Thẻ gợi ý: chạm 1 → Cú đọc mẫu; chạm 2 → nghe học sinh nhại lại. */
  const tapHint = (h: string) => {
    if (armedHint === h) {
      setArmedHint(null)
      setShowHints(false)
      void startListening({ hold: false, expected: h })
      return
    }
    setArmedHint(h)
    replay(h)
  }

  const submitTyped = (e: FormEvent) => {
    e.preventDefault()
    const t = draft.trim()
    if (!t || phase === 'thinking') return
    setDraft('')
    void send(t)
  }

  const finish = async () => {
    abortRef.current?.abort(); stopListen.current?.(); hush()
    // Ngày luyện nói được tính khi đạt mục tiêu buổi (hoặc nói từ 5 câu) → chuỗi ngày luyện nói
    const said = turns.filter((t) => t.role === 'student').length
    if (sg.done || said >= 5) update((p) => recordTalkDay(p, Date.now()))
    const session = getSession()
    const studentTexts = turns.filter((t) => t.role === 'student').map((t) => t.text)
    const used = phrasesUsed(studentTexts, ctx.phrases)
    const words = turns.flatMap((t) => t.meta?.new_words ?? [])
    const fixes = turns.flatMap((t) => (t.meta?.fix ? [t.meta.fix] : []))
    if (words.length || fixes.length) update((p) => addWords(p, [...words, ...fixes.map((f) => ({ en: f.better, vi: `Nói đúng hơn: “${f.said}”` }))], Date.now()))
    setSummary({ phrases_used: [], fixes, tip_vi: '', turns: studentTexts.length, used, words: words.length })
    if (studentTexts.length) {
      setReward(give({ kind: 'dialogue', id: `talk:${lessonId}`, correct: Math.min(studentTexts.length, 10), total: Math.max(studentTexts.length, 1), lessonId: lesson?.id }))
    }
    if (session && studentTexts.length >= 2) {
      const s = await talkSummary(session.token, { lesson: ctx, transcript: turns.slice(-60).map((t) => ({ role: t.role, text: t.text.slice(0, 400) })), session: sessionId.current })
      setSummary((cur) => cur && { ...cur, tip_vi: s.tip_vi, fixes: s.fixes.length ? s.fixes : cur.fixes, used: [...new Set([...cur.used, ...s.phrases_used.filter((p) => ctx.phrases.includes(p))])] })
    }
  }

  const setPron = useCallback((v: boolean) => setSettings((cur) => { const n = { ...cur, pron: v }; saveTalkSettings(n); return n }), [])
  const setSpeed = (v: number) => { const s = { ...settings, speed: v }; setSettings(s); saveTalkSettings(s) }
  const studentTexts = turns.filter((t) => t.role === 'student').map((t) => t.text)
  /** Lời Cú: tô karaoke khi đang đọc + gạch chân từ mới (chạm để xem nghĩa). */
  const tutorText = (t: Turn, i: number) => {
    if (!t.text) return <span className="dots" aria-label="Cú đang nghĩ"><i /><i /><i /></span>
    const words = splitWords(t.text)
    const marks = t.meta?.new_words.length ? markPhrases(words, t.meta.new_words.map((w) => w.en)) : words.map(() => -1)
    const rd = reading?.turn === i ? reading : null
    if (!rd && marks.every((m) => m < 0)) return t.text
    const word = (k: number) => <span key={k} className={rd ? `kara-w ${k < rd.done ? 'rd' : ''} ${k === rd.now ? 'now' : ''}` : undefined}>{words[k]}</span>
    const out: React.ReactNode[] = []
    for (let k = 0; k < words.length; k++) {
      const m = marks[k]
      if (m < 0) { out.push(word(k), ' '); continue }
      const group: React.ReactNode[] = []
      let e = k
      let tail = ''
      while (e < words.length && marks[e] === m) {
        const last = !(e + 1 < words.length && marks[e + 1] === m)
        if (last) {
          // dấu câu cuối (vd. "hometown?") để ngoài phần gạch chân
          const mm = /^(.*?)([^A-Za-z0-9']*)$/.exec(words[e])!
          tail = mm[2]
          group.push(<span key={e} className={rd ? `kara-w ${e < rd.done ? 'rd' : ''} ${e === rd.now ? 'now' : ''}` : undefined}>{mm[1]}</span>)
        } else group.push(word(e), ' ')
        e++
      }
      const open = wordPop?.turn === i && wordPop.w === m
      out.push(<button key={`nw${k}`} className={`nw ${open ? 'open' : ''}`} onClick={() => { setWordPop(open ? null : { turn: i, w: m }); if (!open) replay(t.meta!.new_words[m].en) }}>{group}</button>,
        tail ? <span key={`t${k}`} className={rd ? `kara-w ${e - 1 < rd.done ? 'rd' : ''}` : undefined}>{tail}</span> : null, ' ')
      k = e - 1
    }
    return out
  }

  const goalOn = !!lesson && topic === 'lesson' && ctx.phrases.length > 0
  const usedNow = useMemo(() => (goalOn ? phrasesUsed(studentTexts, ctx.phrases) : []), [goalOn, studentTexts.join('|'), ctx.phrases]) // eslint-disable-line react-hooks/exhaustive-deps
  const usedPrev = useRef<string[]>([])
  useEffect(() => {
    const fresh = usedNow.filter((x) => !usedPrev.current.includes(x))
    usedPrev.current = usedNow
    if (!fresh.length) return
    hapticWin()
    sfx('ok')
    setGoalFlash(fresh[0])
    const t = window.setTimeout(() => setGoalFlash(null), 2200)
    return () => clearTimeout(t)
  }, [usedNow])
  useEffect(() => { usedPrev.current = []; setFixTry({}); setWordPop(null); setFirstAt(null); setGoalAt(null) }, [sessionKey, topic])

  // Mục tiêu buổi nói: 10 câu hoặc 3 phút (tính từ câu đầu tiên)
  const [firstAt, setFirstAt] = useState<number | null>(null)
  const [goalAt, setGoalAt] = useState<number | null>(null) // chỉ số lượt khi vừa đạt mục tiêu (hiện lời chúc ở đó)
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => { if (studentTexts.length && firstAt === null) setFirstAt(Date.now()) }, [studentTexts.length, firstAt])
  const sg = sessionGoal(settings.goal, studentTexts.length, firstAt, nowTick)
  useEffect(() => {
    if (settings.goal !== 'm3' || firstAt === null || sg.done) return
    const t = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [settings.goal, firstAt, sg.done])
  useEffect(() => {
    if (!sg.done || goalAt !== null) return
    setGoalAt(turnsRef.current.map((t) => t.role).lastIndexOf('student')) // ngay sau câu nói giúp đạt mục tiêu
    hapticWin()
    sfx('win')
  }, [sg.done, goalAt])
  const talking = phase === 'speaking' || replaying
  const statusText = phase === 'listening' ? 'Cú đang nghe…' : phase === 'thinking' ? 'Cú đang nghĩ…' : talking ? 'Cú đang nói…' : ''
  const lastTutor = turns.map((t) => t.role).lastIndexOf('tutor')

  // ----- Cú to thu nhỏ & bay vào chỗ avatar (FLIP) -----
  const compact = turns.length > 1
  const bigOwlEl = useRef<HTMLDivElement>(null)
  const miniOwlEl = useRef<HTMLDivElement>(null)
  const flyEl = useRef<HTMLDivElement>(null)
  const bigRect = useRef<DOMRect | null>(null)
  const bigBox = useRef(0)
  const [fly, setFly] = useState<{ from: DOMRect; to: DOMRect } | null>(null)
  const wasCompact = useRef(compact)
  // khi Cú còn to: ghi lại vị trí & chiều cao vùng Cú (để biết điểm xuất phát)
  useLayoutEffect(() => {
    if (compact || !bigOwlEl.current) return
    bigRect.current = bigOwlEl.current.getBoundingClientRect()
    bigBox.current = (bigOwlEl.current.parentElement as HTMLElement).offsetHeight
  })
  // vừa chuyển sang avatar: Cú bay từ chỗ cũ tới avatar, danh sách tin nhắn trượt lên lấp chỗ trống
  useLayoutEffect(() => {
    const was = wasCompact.current
    wasCompact.current = compact
    if (!compact || was || !bigRect.current || !miniOwlEl.current) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setFly({ from: bigRect.current, to: miniOwlEl.current.getBoundingClientRect() })
    listRef.current?.animate([{ transform: `translateY(${bigBox.current}px)` }, { transform: 'none' }], { duration: 560, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
  }, [compact])
  useLayoutEffect(() => {
    if (!fly || !flyEl.current) return
    const { from, to } = fly
    const k = to.width / from.width
    const dx = to.left - from.left, dy = to.top - from.top
    const a = flyEl.current.animate([
      { transform: 'translate(0, 0) scale(1) rotate(0)' },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.35 - 18}px) scale(${(1 + k) / 2}) rotate(-8deg)`, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(${k * 1.12}) rotate(4deg)`, offset: 0.85 },
      { transform: `translate(${dx}px, ${dy}px) scale(${k}) rotate(0)` },
    ], { duration: 600, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' })
    a.onfinish = () => setFly(null)
    return () => a.cancel()
  }, [fly])
  const mood: Mood = phase === 'thinking' ? 'think' : 'idle'

  // ----- Chọn chủ đề (Trò chuyện tự do) -----
  // Vào từ bài học: chọn 1 trong 3 chế độ rồi mới vào phòng nói
  if (!topic && lesson) {
    const pick = (m: 'lesson' | 'free', tp: string) => { setMode(m); setTopic(tp) }
    const MODES = [
      { m: 'lesson' as const, tp: 'lesson', icon: '📘', title: 'Bài giảng', sub: `Cú dạy lần lượt từng cụm từ của bài "${lesson.title}" — bạn nhắc lại và dùng thử.` },
      { m: 'free' as const, tp: 'lesson', icon: '🎭', title: 'Theo bài', sub: 'Trò chuyện theo chủ đề của bài, Cú tạo tình huống để bạn dùng cụm từ vừa học.' },
      { m: 'free' as const, tp: 'daily', icon: '💬', title: 'Free style', sub: 'Nói chuyện thoải mái như ngoài đời — hỏi gì, kể gì cũng được, bạn dẫn dắt.' },
    ]
    return (
      <main className="talk talk-pick">
        <header className="talk-top">
          <button className="talk-x" onClick={() => navigate(-1)} aria-label="Đóng">✕</button>
        </header>
        <Mascot mood="cheer" size={96} />
        <h1 className="talk-h1">Luyện nói với Cú</h1>
        <p className="talk-sub">{lesson.number}. {lesson.title} · chọn cách bạn muốn luyện</p>
        <div className="mode-list">
          {MODES.map((x) => (
            <button key={x.title} className="mode-card" onClick={() => pick(x.m, x.tp)}>
              <span className="mode-ico" aria-hidden>{x.icon}</span>
              <span className="grow"><b>{x.title}</b><small>{x.sub}</small></span>
              <span aria-hidden className="mode-go">›</span>
            </button>
          ))}
        </div>
      </main>
    )
  }

  if (!topic) {
    const fav = new Set(settings.topics)
    const list = [TOPICS[0], ...TOPICS.slice(1).sort((a, b) => Number(fav.has(b.id)) - Number(fav.has(a.id)))]
    return (
      <main className="talk talk-pick">
        <header className="talk-top">
          <button className="talk-x" onClick={() => navigate(-1)} aria-label="Đóng">✕</button>
        </header>
        <Mascot mood="cheer" size={96} />
        <h1 className="talk-h1">Hôm nay mình nói về gì nhỉ?</h1>
        <p className="talk-sub">Chọn <b>Nói gì cũng được</b> để trò chuyện thoải mái như ngoài đời — bạn dẫn dắt, Cú hỏi chuyện theo.</p>
        <div className="topic-grid">
          {list.map((t) => (
            <button key={t.id} className={`topic ${fav.has(t.id) ? 'fav' : ''}`} onClick={() => {
              setTopic(t.id)
              if (!fav.has(t.id)) { const s = { ...settings, topics: [...settings.topics, t.id].slice(-5) }; setSettings(s); saveTalkSettings(s) }
            }}>
              <span aria-hidden>{t.icon}</span>{t.vi}
            </button>
          ))}
        </div>
      </main>
    )
  }

  return (
    <main className="talk">
      <header className="talk-top">
        <button className={`talk-done ${sg.done ? 'ready' : ''}`} onClick={() => (studentTexts.length && !summary ? finish() : navigate(-1))}>{studentTexts.length ? 'Xong' : 'Thoát'}</button>
        <div className="talk-title">
          <b>{lesson ? lesson.title : TOPICS.find((t) => t.id === topic)?.vi}</b>
          {lesson && (
            <button className="mode-chip" onClick={() => { restart(); setTopic(null) }} aria-label="Đổi chế độ luyện nói">
              {mode === 'lesson' ? '📘 Bài giảng' : topic === 'daily' ? '💬 Free style' : '🎭 Theo bài'} <span aria-hidden>⇄</span>
            </button>
          )}
        </div>
        <button className={`talk-x ${showSettings ? 'on' : ''}`} onClick={() => setShowSettings((v) => !v)} aria-label="Cài đặt: tốc độ, chấm phát âm, mục tiêu">⚙️</button>
      </header>

      <div className={`goal-row ${goalFlash ? 'flash' : ''}`}>
        <div className={`goal-seg ${sg.done ? 'done' : ''}`} aria-label={`Mục tiêu buổi: ${sg.label}`}>
          <span className="gs-label">{sg.done ? '✅' : '🎯'} {sg.label}</span>
          <span className="gb-track"><i style={{ width: `${Math.round((sg.value / sg.target) * 100)}%` }} /></span>
        </div>
        {goalOn && (
          <button className={`goal-seg ${usedNow.length >= ctx.phrases.length ? 'done' : ''}`} onClick={() => setShowHints(true)} aria-label={`Đã dùng ${usedNow.length} trên ${ctx.phrases.length} cụm của bài. Chạm để xem gợi ý`}>
            <span className="gs-label">{goalFlash ? <>✅ <b>{goalFlash}</b></> : <>📘 {usedNow.length}/{ctx.phrases.length} cụm</>}</span>
            <span className="gb-track"><i style={{ width: `${Math.round((usedNow.length / ctx.phrases.length) * 100)}%` }} /></span>
          </button>
        )}
      </div>

      {/* Luôn render để chạy hiệu ứng rèm kéo xuống / kéo lên; khi đóng thì inert để không focus/đọc được */}
      <div className={`talk-drawer ${showSettings ? 'open' : ''}`} aria-hidden={!showSettings} {...(showSettings ? {} : { inert: '' })}>
        <div className="talk-drawer-in">
        <div className="talk-speed" role="radiogroup" aria-label="Tốc độ gia sư">
          {SPEEDS.map((s) => (
            <button key={s.v} role="radio" aria-checked={settings.speed === s.v} className={settings.speed === s.v ? 'on' : ''}
              onClick={() => { setSpeed(s.v); speak('Hi! Nice to meet you.', { rate: s.v }) }}>
              <b>{s.v}×</b> {s.label}
            </button>
          ))}
          <div className="goal-pick" role="radiogroup" aria-label="Mục tiêu mỗi buổi nói">
            <small>Mục tiêu mỗi buổi</small>
            {(Object.keys(GOALS) as (keyof typeof GOALS)[]).map((g) => (
              <button key={g} role="radio" aria-checked={settings.goal === g} className={settings.goal === g ? 'on' : ''}
                onClick={() => setSettings((cur) => { const n = { ...cur, goal: g }; saveTalkSettings(n); return n })}>{GOALS[g].label}</button>
            ))}
          </div>
          <PronSetting enabled={settings.pron} onChange={setPron} />
        </div>
        </div>
      </div>
      {fly && (
        <div ref={flyEl} className="owl-fly" aria-hidden style={{ left: fly.from.left, top: fly.from.top, width: fly.from.width, height: fly.from.height }}>
          <Mascot mood={mood} size={fly.from.width} talking={talking} />
        </div>
      )}
      {pronOpen !== null && turns[pronOpen]?.pron?.words && (
        <PronSheet text={turns[pronOpen].text} words={turns[pronOpen].pron!.words!} wavUrl={turns[pronOpen].pron!.wavUrl} rate={settings.speed} onClose={() => setPronOpen(null)} />
      )}

      {turns.length <= 1 && (
        <div className={`talk-owl ${phase} ${talking ? 'talking' : ''}`}>
          <div ref={bigOwlEl} className="big-owl"><Mascot mood={mood} size={88} talking={talking} /></div>
          <span className="owl-status" aria-live="polite">{statusText}</span>
        </div>
      )}

      <div className="talk-list" ref={listRef} aria-live="polite">
        {turns.map((t, i) => t.role === 'tutor' ? (
          <Fragment key={i}>
          <div className={`tutor-row ${turns.length > 1 && i === lastTutor ? 'with-owl' : ''}`}>
          {turns.length > 1 && i === lastTutor && (
            <div ref={miniOwlEl} className="mini-owl" style={fly ? { visibility: 'hidden' } : undefined}><Mascot mood={mood} size={38} talking={talking} /></div>
          )}
          <div className="bub tutor">
            <p>{tutorText(t, i)}</p>
            {wordPop?.turn === i && t.meta?.new_words[wordPop.w] && (
              <div className="nw-pop" role="status">
                <b>{t.meta.new_words[wordPop.w].en}</b><span>{t.meta.new_words[wordPop.w].vi}</span>
                <button onClick={() => replay(t.meta!.new_words[wordPop.w].en)} aria-label="Nghe">🔊</button>
                <small>✓ Đã lưu vào Sổ từ</small>
              </div>
            )}
            {showVi.has(i) && t.meta?.reply_vi && <p className="vi">{t.meta.reply_vi}</p>}
            {t.meta && (
              <div className="bub-tools">
                {t.meta.reply_vi && (
                  <button className={`tool-vi ${showVi.has(i) ? 'on' : ''}`} onClick={() => setShowVi((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })}
                    aria-pressed={showVi.has(i)} aria-label={showVi.has(i) ? 'Ẩn bản dịch' : 'Dịch sang tiếng Việt'}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 5h8M8 3v2M5.5 5c.8 3 2.8 5.4 5.5 6.5M10.5 5c-.8 3.6-3.2 6.4-6.5 7.5" /><path d="M12.5 21l4-9 4 9M14 18h5" /></svg>
                    <span>{showVi.has(i) ? 'Ẩn dịch' : 'Dịch'}</span>
                  </button>
                )}
                <button className="tool-btn" onClick={() => replay(t.text, settings.speed, i)} aria-label="Nói lại"><span aria-hidden>🔁</span><span>Nói lại</span></button>
                <button className="tool-btn" onClick={() => replay(t.text, Math.max(0.6, settings.speed - 0.25), i)} aria-label="Nói chậm hơn"><span aria-hidden>🐢</span><span>Chậm hơn</span></button>
              </div>
            )}
            {t.meta?.fix && (
              <div className="fix"><small>Nói đúng hơn</small><s>{t.meta.fix.said}</s><b>{t.meta.fix.better}</b>
                <div className="fix-acts">
                  <button className="fix-btn" onClick={() => replay(t.meta!.fix!.better)}><span aria-hidden>🔊</span>Nghe</button>
                  <button className={`fix-btn mic ${fixTry[i]?.status === 'listening' ? 'on' : ''}`} onClick={() => (fixTry[i]?.status === 'listening' ? stopListen.current?.() : void practiceFix(i, t.meta!.fix!.better))}>
                    <span aria-hidden>{fixTry[i]?.status === 'listening' ? '■' : '🎤'}</span>{fixTry[i]?.status === 'listening' ? 'Dừng' : 'Nói lại'}
                  </button>
                </div>
                {fixTry[i] && (
                  <div className={`fix-try ${fixTry[i].status} ${fixTry[i].cmp?.pass ? 'pass' : ''}`}>
                    {fixTry[i].status === 'listening' && <span>🎙️ {fixTry[i].heard || 'Đang nghe… đọc câu đúng nhé'}</span>}
                    {fixTry[i].status === 'error' && <span>{fixTry[i].msg}</span>}
                    {fixTry[i].status === 'done' && fixTry[i].cmp && (
                      <>
                        <span className="ft-head">{fixTry[i].cmp!.pass ? '✅ Chuẩn rồi!' : '💪 Gần đúng — từ đỏ là Cú chưa nghe thấy'}</span>
                        <span className="ft-words">{fixTry[i].cmp!.words.map((w, k) => {
                          const pr = fixTry[i].pron?.find((x) => x.word.toLowerCase() === w.word.replace(/[^A-Za-z']/g, '').toLowerCase())
                          const cls = !w.ok ? 'miss' : pr ? ({ 'Tốt': 'ok', 'Khá': 'mid', 'Cần luyện': 'bad' } as const)[pr.level] : 'ok'
                          return <Fragment key={k}><span className={`ftw ${cls}`}>{w.word}</span>{' '}</Fragment>
                        })}</span>
                        <small>Bạn nói: “{fixTry[i].heard}”</small>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            {(() => {
              if (!t.meta?.new_words.length) return null
              const marks = markPhrases(splitWords(t.text), t.meta.new_words.map((w) => w.en))
              const extra = t.meta.new_words.filter((_, k) => !marks.includes(k)) // từ mới không có trong câu → vẫn hiện thẻ
              return extra.length ? (
                <div className="words">{extra.map((w) => (
                  <button key={w.en} className="word" onClick={() => replay(w.en)}>✨ <b>{w.en}</b> · {w.vi}</button>
                ))}</div>
              ) : null
            })()}
          </div>
          </div>
          {turns.length > 1 && i === lastTutor && statusText && <div className="owl-status mini" aria-live="polite">{statusText}</div>}
          </Fragment>
        ) : (
          <Fragment key={i}>
          <div className="bub student"><p>{t.pron?.status === 'done' && t.pron.words && t.pron.of === t.text
            ? t.pron.words.map((w, k) => <Fragment key={k}><span className={`pw-${!w.known ? 'na' : ({ 'Tốt': 'ok', 'Khá': 'mid', 'Cần luyện': 'bad' } as const)[w.level]}`}>{w.word}</span>{' '}</Fragment>)
            : t.text}</p>
            {t.pron && <PronChip status={t.pron.status} words={t.pron.words} onOpen={() => setPronOpen(i)} />}
          </div>
          {goalAt === i && <div className="talk-cheer" role="status">🎉 Bạn đã đạt mục tiêu buổi nói! Nói tiếp hoặc bấm <b>Xong</b>.</div>}
          </Fragment>
        ))}
        {turns.length > 1 && lastTutor < turns.length - 1 && statusText && <div className="owl-status mini" aria-live="polite">{statusText}</div>}
        {phase === 'listening' && (
          <div className="bub student live" aria-live="polite">
            <p>{partial ? <>{partial}</> : <span className="live-hint">{holding ? 'Đang nghe… nói đi, thả tay để gửi' : 'Đang nghe… nói đi'}</span>}<i className="caret" aria-hidden /></p>
            <span className="lvl" aria-hidden>{levels.map((v, k) => <i key={k} style={{ transform: `scaleY(${0.15 + v * 0.85})` }} />)}</span>
          </div>
        )}
        {error && <div className="talk-error" role="alert">{error}</div>}
        {outOfTurns && (
          <div className="talk-quota" role="alert">
            <Mascot mood="idle" size={64} />
            <b>Bạn đã hết lượt luyện nói hôm nay</b>
            <span>Cú hẹn bạn vào ngày mai nhé! 🦉</span>
            {studentTexts.length && !summary
              ? <button className="btn btn-primary" onClick={() => void finish()}>Xem tổng kết</button>
              : <button className="btn btn-ghost" onClick={() => navigate(-1)}>Về trang chủ</button>}
          </div>
        )}
      </div>

      {showHints && (
        <div className="talk-hints">
          <small>Thử nói — chạm để nghe, chạm lần nữa để nói theo:</small>
          {(hints(ctx.phrases, studentTexts).length ? hints(ctx.phrases, studentTexts) : ['Can you say that again, please?', 'What about you?']).map((h) => (
            <button key={h} className={`hint-card ${armedHint === h ? 'armed' : ''}`} onClick={() => tapHint(h)}>
              <span className="hc-text">{h}</span>
              <span className="hc-act">{armedHint === h ? '🎤 Chạm lần nữa để nói theo' : '🔊 Chạm để Cú đọc mẫu'}</span>
            </button>
          ))}
        </div>
      )}

      {!outOfTurns && quota && quota.limit - quota.used <= 3 && (
        <p className="talk-left" role="status">Hôm nay còn <b>{quota.limit - quota.used}</b> lượt nói với Cú</p>
      )}
      {outOfTurns ? null : typing ? (
        <form className="talk-bar typing" onSubmit={submitTyped}>
          {hasRecognition() && <button type="button" className="tb-side" onClick={() => setTyping(false)} aria-label="Nói bằng micro">🎤</button>}
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Gõ câu trả lời tiếng Anh…" autoCapitalize="sentences" maxLength={300} />
          <button type="button" className={`tb-side ${showHints ? 'on' : ''}`} onClick={() => setShowHints((v) => !v)} aria-label="Gợi ý câu trả lời">✨</button>
          <button className="tb-send" type="submit" disabled={!draft.trim()}>Gửi</button>
        </form>
      ) : (
        <div className="talk-bar">
          <button className="tb-side" onClick={() => setTyping(true)} aria-label="Gõ phím">⌨️</button>
          <button className={`tb-mic ${phase} ${holding ? 'holding' : ''}`} onPointerDown={micDown} onPointerUp={micUp} onPointerCancel={micUp}
            onClick={micKey} onContextMenu={(e) => e.preventDefault()}
            aria-label={phase === 'listening' ? (holding ? 'Thả để gửi' : 'Dừng nghe và gửi') : 'Giữ để nói, hoặc chạm để nói rảnh tay'}>
            {phase === 'listening' && !holding ? '■' : '🎤'}
          </button>
          <button className={`tb-side ${showHints ? 'on' : ''}`} onClick={() => setShowHints((v) => !v)} aria-label="Gợi ý câu trả lời">✨</button>
        </div>
      )}
      {!settings.onboarded && !outOfTurns && phase === 'idle' && !typing && <p className="mic-tip">Giữ 🎤 để nói · thả tay để gửi</p>}

      {summary && (
        <div className="sheet-backdrop" onClick={() => navigate(-1)}>
          <div className="sheet talk-sum" role="dialog" aria-modal="true" aria-label="Tổng kết" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" aria-hidden />
            <div className="sheet-title">🦉 Tổng kết buổi nói</div>
            <div className="sum-stats">
              <div><b>{summary.turns}</b><small>lượt nói</small></div>
              <div><b>{summary.used.length}{ctx.phrases.length ? `/${ctx.phrases.length}` : ''}</b><small>cụm của bài</small></div>
              <div><b>{summary.words}</b><small>từ mới</small></div>
            </div>
            {(() => {
              const streak = currentTalkStreak(prog, Date.now())
              const days = new Set(prog.talk.days)
              const week = Array.from({ length: 7 }, (_, k) => { const d = new Date(); d.setDate(d.getDate() - (6 - k)); return { key: dayKey(d.getTime()), label: 'CN T2 T3 T4 T5 T6 T7'.split(' ')[d.getDay()] } })
              return (
                <div className="sum-streak">
                  <div className="ss-head">{streak > 0 ? <>🔥 <b>{streak} ngày</b> luyện nói liên tiếp</> : <>Nói đủ {GOALS[settings.goal].label.toLowerCase()} để bắt đầu chuỗi ngày luyện nói 🔥</>}</div>
                  <div className="ss-week">{week.map((w) => <span key={w.key} className={days.has(w.key) ? 'on' : ''}><i />{w.label}</span>)}</div>
                </div>
              )
            })()}
            {!!summary.used.length && <p className="sum-used">✅ {summary.used.join(' · ')}</p>}
            {!!summary.fixes.length && (
              <div className="sum-fixes"><small>Câu nên sửa</small>
                {summary.fixes.map((f, i) => <div key={i} className="fix"><s>{f.said}</s><b>{f.better}</b></div>)}
              </div>
            )}
            {summary.tip_vi && <p className="sum-tip">💡 {summary.tip_vi}</p>}
            {summary.words > 0 && <p className="sum-note">Từ mới đã được lưu vào <b>Sổ từ của tôi</b> để ôn lại.</p>}
            <RewardInline report={reward} />
            <div className="row">
              <button className="btn btn-ghost grow" onClick={() => navigate(-1)}>Xong</button>
              <button className="btn btn-primary grow" onClick={() => { setSummary(null); setReward(null); restart() }}>Nói tiếp</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
