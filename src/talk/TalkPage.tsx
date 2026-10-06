import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getLesson } from '../lessons'
import { getSession } from '../lib/auth'
import { ApiError } from '../lib/api'
import { hasRecognition, listen } from '../lib/recognition'
import { speak, stopSpeaking } from '../lib/speech'
import { sfx } from '../lib/sfx'
import { Mascot, type Mood } from '../motivation/Mascot'
import { useReward } from '../motivation/useReward'
import { RewardInline } from '../motivation/Reward'
import type { RewardReport } from '../motivation/engine'
import { talkSummary, talkTurn, type TalkSummary, type TurnBody } from './api'
import { hints, historyFor, phrasesUsed, SentenceChunker, type Turn } from './core'
import { loadTalkSettings, saveTalkSettings, SPEEDS, TOPICS } from './settings'
import { addWords } from './words'
import { useProgress } from '../lib/ProgressContext'
import { startCapture, toWav, type Capture } from '../pron/capture'
import { analyze } from '../pron/engine'
import { isModelReady } from '../pron/model'
import { PronChip, PronSetting, PronSheet } from '../pron/PronPanel'
import './talk.css'

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking'

/** Luyện nói với Cú: /talk/:lessonId  (lessonId = 'free' → Trò chuyện tự do theo chủ đề). */
export function TalkPage() {
  const { lessonId = 'free' } = useParams()
  const navigate = useNavigate()
  const lesson = lessonId === 'free' ? undefined : getLesson(lessonId)
  const [, update] = useProgress()
  const give = useReward()
  const [settings, setSettings] = useState(loadTalkSettings)
  const [mode, setMode] = useState<'lesson' | 'free'>(lesson ? 'lesson' : 'free')
  const [topic, setTopic] = useState<string | null>(lesson ? 'lesson' : null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [phase, setPhase] = useState<Phase>('idle')
  const [partial, setPartial] = useState('')
  const [typing, setTyping] = useState(!hasRecognition())
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [showVi, setShowVi] = useState<Set<number>>(new Set())
  const [showHints, setShowHints] = useState(false)
  const [summary, setSummary] = useState<(TalkSummary & { turns: number; used: string[]; words: number }) | null>(null)
  const [reward, setReward] = useState<RewardReport | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [pronOpen, setPronOpen] = useState<number | null>(null)
  const [pronReady, setPronReady] = useState(false)
  useEffect(() => { if (settings.pron) void isModelReady().then(setPronReady) }, [settings.pron])

  const ctx = useMemo(() => ({
    title: lesson?.title ?? 'Free conversation',
    titleVi: lesson?.titleVi ?? '',
    phrases: lesson ? lesson.phrases.slice(0, 8).map((p) => p.en) : [],
  }), [lesson])
  const topicEn = topic && topic !== 'lesson' ? TOPICS.find((t) => t.id === topic)?.en : undefined

  // ----- giọng gia sư: đọc từng câu ngay khi có, theo hàng đợi; có thể ngắt -----
  const speakChain = useRef<Promise<void>>(Promise.resolve())
  const speakGen = useRef(0)
  const say = useCallback((s: string) => {
    const gen = speakGen.current
    speakChain.current = speakChain.current.then(() => (gen === speakGen.current ? speak(s, { rate: settings.speed }) : undefined))
  }, [settings.speed])
  const hush = useCallback(() => { speakGen.current++; stopSpeaking(); speakChain.current = Promise.resolve() }, [])

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
    const tutorIdx = withStudent.length
    setTurns([...withStudent, { role: 'tutor', text: '' }])
    setPhase('thinking')
    const chunker = new SentenceChunker(say)
    const body: TurnBody = { mode, lesson: ctx, topic: topicEn, history: historyFor(before), text }
    try {
      const meta = await talkTurn(session.token, body, (t) => {
        setPhase('speaking')
        chunker.push(t)
        setTurns((ts) => ts.map((x, i) => (i === tutorIdx ? { ...x, text: x.text + t } : x)))
      }, ac.signal)
      chunker.end()
      setTurns((ts) => ts.map((x, i) => (i === tutorIdx ? { ...x, text: meta.reply || x.text, meta } : x)))
      speakChain.current.then(() => { if (!ac.signal.aborted) setPhase('idle') })
    } catch (e) {
      if (ac.signal.aborted) return
      setTurns((ts) => ts.filter((_, i) => i !== tutorIdx))
      setError(e instanceof ApiError ? e.message : 'Cú chưa nghe rõ, thử lại nhé')
      setPhase('idle')
    }
  }, [ctx, hush, mode, say, topicEn])

  // Bắt đầu (và mỗi lần đổi chế độ / "Nói tiếp"): xoá hội thoại, gia sư chào trước
  const [sessionKey, setSessionKey] = useState(0)
  const restart = () => { abortRef.current?.abort(); hush(); turnsRef.current = []; setTurns([]); setSessionKey((k) => k + 1) }
  useEffect(() => {
    if (topic) void send('')
  }, [topic, sessionKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { abortRef.current?.abort(); stopListen.current?.(); stopSpeaking() }, [])

  /** Chấm phát âm câu vừa nói (chạy nền); gắn kết quả vào lượt của học sinh ở vị trí idx. */
  const scorePron = (cap: Capture, idx: number, text: string) => {
    const setPron = (pron: Turn['pron']) => setTurns((ts) => ts.map((x, i) => (i === idx && x.role === 'student' ? { ...x, pron } : x)))
    void cap.stop().then(async (pcm) => {
      if (pcm.length < 16000 * 0.4) return // quá ngắn
      const wavUrl = URL.createObjectURL(toWav(pcm))
      setPron({ status: 'pending', wavUrl })
      try { setPron({ status: 'done', wavUrl, words: (await analyze(pcm, text)).words }) } catch { setPron({ status: 'error', wavUrl }) }
    })
  }

  const mic = async () => {
    if (phase === 'listening') { stopListen.current?.(); return }
    if (phase === 'speaking' || phase === 'thinking') { abortRef.current?.abort(); hush() } // chạm để ngắt lời Cú
    setError('')
    setPartial('')
    setPhase('listening')
    sfx('pop')
    // Chấm phát âm: thu âm song song với nhận giọng (chỉ khi đã bật + đã tải bộ chấm)
    const cap = settings.pron && pronReady ? await startCapture().catch(() => null) : null
    const l = listen({ silenceMs: 800, onPartial: setPartial })
    stopListen.current = l.stop
    l.promise.then((alts) => {
      setPartial('')
      const idx = turnsRef.current.length
      void send(alts[0])
      if (cap) scorePron(cap, idx, alts[0])
    }).catch((e) => {
      cap?.cancel()
      setPartial('')
      setPhase('idle')
      if (e === 'denied' || e === 'unsupported') { setTyping(true); setError('Không dùng được micro — bạn gõ câu trả lời nhé') }
      else if (e === 'no-speech') setError('Cú chưa nghe thấy gì, bấm micro rồi nói nhé')
    })
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
      const s = await talkSummary(session.token, { lesson: ctx, transcript: turns.slice(-60).map((t) => ({ role: t.role, text: t.text.slice(0, 400) })) })
      setSummary((cur) => cur && { ...cur, tip_vi: s.tip_vi, fixes: s.fixes.length ? s.fixes : cur.fixes, used: [...new Set([...cur.used, ...s.phrases_used.filter((p) => ctx.phrases.includes(p))])] })
    }
  }

  const setSpeed = (v: number) => { const s = { ...settings, speed: v }; setSettings(s); saveTalkSettings(s) }
  const studentTexts = turns.filter((t) => t.role === 'student').map((t) => t.text)
  const mood: Mood = phase === 'thinking' ? 'think' : phase === 'speaking' ? 'cheer' : phase === 'listening' ? 'idle' : 'idle'

  // ----- Chọn chủ đề (Trò chuyện tự do) -----
  if (!topic) {
    const fav = new Set(settings.topics)
    const list = [...TOPICS].sort((a, b) => Number(fav.has(b.id)) - Number(fav.has(a.id)))
    return (
      <main className="talk talk-pick">
        <header className="talk-top">
          <button className="talk-x" onClick={() => navigate(-1)} aria-label="Đóng">✕</button>
        </header>
        <Mascot mood="cheer" size={96} />
        <h1 className="talk-h1">Hôm nay mình nói về gì nhỉ?</h1>
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
        <button className="talk-x" onClick={() => (studentTexts.length && !summary ? finish() : navigate(-1))} aria-label="Kết thúc">✕</button>
        <div className="talk-title">
          <b>{lesson ? lesson.title : TOPICS.find((t) => t.id === topic)?.vi}</b>
          {lesson && (
            <div className="talk-modes" role="tablist">
              {(['lesson', 'free'] as const).map((m) => (
                <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''}
                  onClick={() => { if (mode !== m) { setMode(m); restart() } }}>
                  {m === 'lesson' ? 'Bài giảng' : 'Tự do'}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="talk-x" onClick={() => setShowSettings((v) => !v)} aria-label="Tốc độ gia sư">⚙️</button>
      </header>

      {showSettings && (
        <div className="talk-speed" role="radiogroup" aria-label="Tốc độ gia sư">
          {SPEEDS.map((s) => (
            <button key={s.v} role="radio" aria-checked={settings.speed === s.v} className={settings.speed === s.v ? 'on' : ''}
              onClick={() => { setSpeed(s.v); speak('Hi! Nice to meet you.', { rate: s.v }) }}>
              <b>{s.v}×</b> {s.label}
            </button>
          ))}
          <PronSetting enabled={settings.pron} onChange={(v) => { const n = { ...settings, pron: v }; setSettings(n); saveTalkSettings(n); if (v) void isModelReady().then(setPronReady) }} />
        </div>
      )}
      {pronOpen !== null && turns[pronOpen]?.pron?.words && (
        <PronSheet text={turns[pronOpen].text} words={turns[pronOpen].pron!.words!} wavUrl={turns[pronOpen].pron!.wavUrl} rate={settings.speed} onClose={() => setPronOpen(null)} />
      )}

      <div className={`talk-owl ${phase}`}><Mascot mood={mood} size={88} /></div>

      <div className="talk-list" ref={listRef} aria-live="polite">
        {turns.map((t, i) => t.role === 'tutor' ? (
          <div key={i} className="bub tutor">
            <p>{t.text || <span className="dots" aria-label="Cú đang nghĩ"><i /><i /><i /></span>}</p>
            {showVi.has(i) && t.meta?.reply_vi && <p className="vi">{t.meta.reply_vi}</p>}
            {t.meta && (
              <div className="bub-tools">
                {t.meta.reply_vi && <button onClick={() => setShowVi((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })} aria-label="Dịch">🌐</button>}
                <button onClick={() => { hush(); speak(t.text, { rate: settings.speed }) }} aria-label="Nghe lại">🔊</button>
              </div>
            )}
            {t.meta?.fix && (
              <div className="fix"><small>Nói đúng hơn</small><s>{t.meta.fix.said}</s><b>{t.meta.fix.better}</b>
                <button onClick={() => speak(t.meta!.fix!.better, { rate: settings.speed })} aria-label="Nghe câu đúng">🔊</button></div>
            )}
            {!!t.meta?.new_words.length && (
              <div className="words">{t.meta.new_words.map((w) => (
                <button key={w.en} className="word" onClick={() => speak(w.en, { rate: settings.speed })}>✨ <b>{w.en}</b> · {w.vi}</button>
              ))}</div>
            )}
          </div>
        ) : (
          <div key={i} className="bub student"><p>{t.text}</p>
            {t.pron && <PronChip status={t.pron.status} words={t.pron.words} onOpen={() => setPronOpen(i)} />}
          </div>
        ))}
        {partial && <div className="bub student live"><p>{partial}…</p></div>}
        {error && <div className="talk-error" role="alert">{error}</div>}
      </div>

      {showHints && (
        <div className="talk-hints">
          <small>Thử nói:</small>
          {(hints(ctx.phrases, studentTexts).length ? hints(ctx.phrases, studentTexts) : ['Can you say that again, please?', 'What about you?']).map((h) => (
            <button key={h} onClick={() => speak(h, { rate: settings.speed })}>🔊 {h}</button>
          ))}
        </div>
      )}

      {typing ? (
        <form className="talk-bar typing" onSubmit={submitTyped}>
          {hasRecognition() && <button type="button" className="tb-side" onClick={() => setTyping(false)} aria-label="Nói bằng micro">🎤</button>}
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Gõ câu trả lời tiếng Anh…" autoCapitalize="sentences" maxLength={300} />
          <button type="button" className={`tb-side ${showHints ? 'on' : ''}`} onClick={() => setShowHints((v) => !v)} aria-label="Gợi ý câu trả lời">✨</button>
          <button className="tb-send" type="submit" disabled={!draft.trim()}>Gửi</button>
        </form>
      ) : (
        <div className="talk-bar">
          <button className="tb-side" onClick={() => setTyping(true)} aria-label="Gõ phím">⌨️</button>
          <button className={`tb-mic ${phase}`} onClick={() => void mic()} aria-label={phase === 'listening' ? 'Dừng nghe' : 'Nói'}>
            {phase === 'listening' ? '■' : '🎤'}
          </button>
          <button className={`tb-side ${showHints ? 'on' : ''}`} onClick={() => setShowHints((v) => !v)} aria-label="Gợi ý câu trả lời">✨</button>
        </div>
      )}
      <p className="talk-status">
        {phase === 'listening' ? 'Cú đang nghe… nói xong sẽ tự gửi' : phase === 'thinking' ? 'Cú đang nghĩ…' : phase === 'speaking' ? 'Chạm 🎤 để ngắt lời Cú' : 'Chạm 🎤 rồi nói tiếng Anh'}
        {studentTexts.length > 0 && !summary && <button className="talk-end" onClick={finish}>Kết thúc</button>}
        {!settings.pron && <button className="talk-end" onClick={() => setShowSettings(true)}>🎯 Bật chấm phát âm</button>}
      </p>

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
