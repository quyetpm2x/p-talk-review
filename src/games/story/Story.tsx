import { useEffect, useMemo, useRef, useState } from 'react'
import type { CustomGameProps } from '../types'
import type { Item } from '../../lib/picker'
import { shuffle } from '../../lib/shuffle'
import { speak, stopSpeaking } from '../../lib/speech'
import { isMuted, setMuted, sfx } from '../../lib/sfx'
import { burst, celebrate } from '../../lib/fx'
import { buzz } from '../../lib/haptics'
import { SpeakButton } from '../../components/SpeakButton'
import { Character, MOOD_EMOJI } from './Character'
import { prefersReducedMotion, useTypewriter } from './useTypewriter'
import {
  choiceDelta, clamp100, endingFor, findItem, getStory, sayable, unlockedEndings, unlockEnding, PLAYER_VOICE, START_CLOSENESS,
  type ChoiceKind, type Mood, type StoryChoice, type StoryEnding,
} from './data'
import './story.css'

type Phase = 'intro' | 'line' | 'choose' | 'react' | 'end'

const KIND_MOOD: Record<ChoiceKind, Mood> = { good: 'happy', off: 'meh', rude: 'awkward' }
const KIND_LABEL: Record<ChoiceKind, string> = { good: '✓ Hợp tình huống', off: '≈ Sai sắc thái', rude: '✕ Kém lịch sự' }

/** 🎬 Phim tương tác: gặp lại bạn cũ ở quán cà phê, chọn câu đáp để giữ độ thân thiết. */
export function Story({ lesson, record, finish }: CustomGameProps) {
  const story = getStory(lesson.id)!
  const nodes = useMemo(() => new Map(story.nodes.map((n) => [n.id, n])), [story])
  const [run, setRun] = useState(0)
  const [phase, setPhase] = useState<Phase>('intro')
  const [nodeId, setNodeId] = useState(story.start)
  const [turn, setTurn] = useState(1)
  const [closeness, setCloseness] = useState(START_CLOSENESS)
  const [delta, setDelta] = useState<{ v: number; k: number } | null>(null)
  const [picked, setPicked] = useState<StoryChoice | null>(null)
  const [ending, setEnding] = useState<StoryEnding | null>(null)
  const [unlocked, setUnlocked] = useState<string[]>(() => unlockedEndings(lesson.id))
  const [voiceOn, setVoiceOn] = useState(!isMuted())
  const answers = useRef<{ item: Item; correct: boolean }[]>([])
  const startedAt = useRef(Date.now())
  const bodyRef = useRef<HTMLDivElement>(null)

  const node = nodes.get(nodeId)!
  const good = node.choices.find((c) => c.kind === 'good')!
  const order = useMemo(() => shuffle(node.choices), [node, run]) // eslint-disable-line react-hooks/exhaustive-deps

  // Câu đang nằm trong bong bóng thoại
  const line = phase === 'end' ? ending : phase === 'react' ? picked?.reply ?? null : phase === 'intro' ? null : node
  const text = line?.en ?? ''
  const tw = useTypewriter(text)

  const mood: Mood =
    phase === 'end' ? ending?.mood ?? 'idle'
    : phase === 'react' && picked ? KIND_MOOD[picked.kind]
    : phase === 'line' && !tw.done ? 'talk'
    : 'idle'

  // Gõ xong câu của bạn cũ → tới lượt chọn
  useEffect(() => {
    if (phase === 'line' && tw.done && text) setPhase('choose')
  }, [phase, tw.done, text])

  // Tự đọc câu mới
  useEffect(() => {
    if (text && voiceOn) speak(sayable(text), { kokoro: story.friend.voice, voice: 'B' })
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopSpeaking(), [])

  // Cuộn phần dưới lên đầu mỗi khi đổi bước; tới lượt chọn thì kéo các lựa chọn vào tầm nhìn (màn hình thấp)
  const choicesRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (phase === 'choose') choicesRef.current?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    else bodyRef.current?.scrollTo({ top: 0 })
  }, [phase, nodeId])

  const start = () => {
    startedAt.current = Date.now()
    sfx('whoosh')
    setPhase('line')
  }

  const choose = (c: StoryChoice, e: React.MouseEvent) => {
    if (phase !== 'choose') return
    const ok = c.kind === 'good'
    const items = (good.toolkit ?? []).map((id) => findItem(lesson, id)).filter((x): x is Item => !!x)
    items.forEach((it) => record(it.id, ok))
    if (items[0]) answers.current.push({ item: items[0], correct: ok })
    const d = choiceDelta(c)
    setCloseness((x) => clamp100(x + d))
    setDelta({ v: d, k: Date.now() })
    setPicked(c)
    setPhase('react')
    sfx(ok ? 'ok' : 'bad')
    buzz(ok)
    if (ok) burst(e.clientX, e.clientY, 22)
  }

  const next = () => {
    const nx = picked?.next ?? node.next
    setPicked(null)
    if (nx) {
      setNodeId(nx)
      setTurn((t) => t + 1)
      setPhase('line')
      sfx('whoosh')
      return
    }
    const end = endingFor(story, closeness)
    const best = [...story.endings].sort((a, b) => b.min - a.min)[0]
    setEnding(end)
    setUnlocked(unlockEnding(lesson.id, end.id))
    setPhase('end')
    if (end.id === best.id) { sfx('win'); celebrate() } else sfx(end.min > 0 ? 'ok' : 'lose')
  }

  const restart = () => {
    stopSpeaking()
    answers.current = []
    setRun((r) => r + 1)
    setNodeId(story.start)
    setTurn(1)
    setCloseness(START_CLOSENESS)
    setDelta(null)
    setPicked(null)
    setEnding(null)
    startedAt.current = Date.now()
    setPhase('line')
  }

  const showResult = () => {
    stopSpeaking()
    const a = answers.current
    const correct = a.filter((x) => x.correct).length
    finish({
      score: closeness + correct * 10,
      correct,
      total: a.length,
      wrong: a.filter((x) => !x.correct).map((x) => x.item),
      answers: a,
      seconds: Math.round((Date.now() - startedAt.current) / 1000),
    })
  }

  const toggleVoice = () => {
    const on = !voiceOn
    setVoiceOn(on)
    setMuted(!on)
    if (!on) stopSpeaking()
  }

  const heart = closeness >= 80 ? '💖' : closeness >= 50 ? '💛' : closeness >= 30 ? '🤍' : '💔'
  const sortedEndings = [...story.endings].sort((a, b) => b.min - a.min)

  return (
    <div className="story">
      <div className="story-hud">
        <span className="close-heart" aria-hidden key={heart}>{heart}</span>
        <div className="close-box">
          <div className="close-label">
            <span>Độ thân thiết</span>
            <b key={closeness} className="close-num">{closeness}</b>
          </div>
          <div className="close-meter" role="progressbar" aria-valuenow={closeness} aria-valuemin={0} aria-valuemax={100} aria-label="Độ thân thiết">
            <div className={`close-fill ${closeness < 40 ? 'low' : closeness >= 80 ? 'high' : ''}`} style={{ width: `${closeness}%` }} />
          </div>
          {delta && (
            <span key={delta.k} className={`close-delta ${delta.v >= 0 ? 'up' : 'down'}`}>{delta.v > 0 ? `+${delta.v}` : delta.v}</span>
          )}
        </div>
        {phase !== 'intro' && phase !== 'end' && <span className="tag">Lượt {turn}</span>}
        <button className="hud-btn" onClick={toggleVoice} aria-label={voiceOn ? 'Tắt tiếng' : 'Bật tiếng'}>{voiceOn ? '🔊' : '🔇'}</button>
      </div>

      <div className="story-scene" aria-hidden>
        <div className="cafe-window"><span /></div>
        <div className="cafe-lamp l1" />
        <div className="cafe-lamp l2" />
        <div className="cafe-board">MENU<small>latte · cà phê sữa</small></div>
        <div className="cafe-shelf"><span>🪴</span><span>☕</span><span>🫖</span></div>
        <div className="cafe-wainscot" />
        <div className={`char-wrap ${phase === 'react' && picked ? `react-${picked.kind}` : ''}`} key={`${nodeId}-${phase === "react" || phase === "end" ? phase : "t"}`}>
          <Character mood={mood} />
          {MOOD_EMOJI[mood] && <span className="mood-badge" key={mood}>{MOOD_EMOJI[mood]}</span>}
        </div>
        <div className="cafe-table"><span className="cup">☕</span><span className="cake">🍰</span></div>
        <div className="scene-name">{story.friend.name}</div>
      </div>

      <div className="story-body" ref={bodyRef}>
        {phase === 'intro' ? (
          <div className="card stack story-intro">
            <div className="label">🎬 {story.title}</div>
            <p>{story.setting}</p>
            <p className="small muted">
              Chọn câu đáp <b>hợp tình huống</b> để tăng độ thân thiết 💛. Câu sai sắc thái hay kém lịch sự sẽ làm {story.friend.name} hụt hẫng. Có {story.endings.length} cái kết khác nhau!
            </p>
            <button className="btn btn-primary btn-block" onClick={start}>▶ Bắt đầu</button>
          </div>
        ) : (
          line && (
            <div className="bubble-wrap" key={`${nodeId}-${phase === 'choose' ? 'line' : phase}`}>
              <div className="talk-bubble" onClick={tw.skip}>
                <div className="bubble-head">
                  <span className="bubble-name">{story.friend.name}</span>
                  <SpeakButton text={sayable(text)} size="sm" kokoro={story.friend.voice} voice="B" />
                </div>
                <div className="bubble-en" aria-live="polite">
                  {tw.shown}
                  {!tw.done && <span className="caret" />}
                  {/* giữ chỗ để bong bóng không nhảy kích thước khi đang gõ */}
                  <span className="bubble-ghost" aria-hidden>{text.slice(tw.shown.length)}</span>
                </div>
                <div className={`bubble-vi ${tw.done ? 'on' : ''}`}>{line.vi}</div>
              </div>
            </div>
          )
        )}

        {phase === 'line' && <div className="story-hint small muted">Chạm vào bong bóng để hiện hết câu</div>}

        {phase === 'choose' && (
          <div className="choices story-choices" ref={choicesRef}>
            <div className="q-label">Bạn đáp lại thế nào?</div>
            {order.map((c, i) => (
              <button key={c.en} className="choice" style={{ animationDelay: `${i * 70}ms` }} onClick={(e) => choose(c, e)}>
                <span className="key">{'ABC'[i]}</span>
                <span className="grow">{c.en}</span>
              </button>
            ))}
          </div>
        )}

        {phase === 'react' && picked && (
          <div className={`story-feedback kind-${picked.kind}`}>
            <div className="row fb-top">
              <span className={`kind-badge ${picked.kind}`}>{KIND_LABEL[picked.kind]}</span>
              <span className="grow" />
              <span className={`fb-delta ${choiceDelta(picked) >= 0 ? 'up' : 'down'}`}>
                {choiceDelta(picked) > 0 ? `+${choiceDelta(picked)}` : choiceDelta(picked)} 💛
              </span>
            </div>
            <div className="fb-said">“{picked.en}”</div>
            <div className="fb-said-vi small muted">{picked.vi}</div>
            <p className="fb-explain">{picked.explain}</p>
            {picked.kind !== 'good' && (
              <div className="fb-better">
                <div className="label">Câu hợp hơn</div>
                <div className="row">
                  <span className="grow"><b>{good.en}</b><div className="small muted">{good.vi}</div></span>
                  <SpeakButton text={sayable(good.en)} size="sm" kokoro={PLAYER_VOICE} />
                </div>
              </div>
            )}
          </div>
        )}
        {phase === 'react' && picked && (
          <div className="story-next">
            <button className="btn btn-dark btn-block" onClick={next}>
              {picked.next ?? node.next ? 'Tiếp tục ▶' : 'Xem cái kết 🎬'}
            </button>
          </div>
        )}

        {phase === 'end' && ending && (
          <div className="story-ending">
            <div className={`ending-hero ${ending.min > 0 ? '' : 'sad'}`}>
              <div className="ending-icon">{ending.icon}</div>
              <div className="label">Cái kết của bạn</div>
              <div className="ending-title">{ending.title}</div>
              <p>{ending.desc}</p>
            </div>
            <div className="card ending-list">
              <div className="row">
                <b className="grow">Bộ sưu tập cái kết</b>
                <span className="tag accent">{unlocked.filter((id) => story.endings.some((e) => e.id === id)).length}/{story.endings.length}</span>
              </div>
              {sortedEndings.map((e, i) => {
                const need = e.min > 0 ? `Cần độ thân thiết ≥ ${e.min}` : `Khi độ thân thiết < ${sortedEndings[i - 1]?.min ?? 100}`
                const open = unlocked.includes(e.id)
                return (
                  <div key={e.id} className={`ending-row ${open ? 'open' : 'locked'} ${e.id === ending.id ? 'now' : ''}`}>
                    <span className="ending-row-icon">{open ? e.icon : '🔒'}</span>
                    <span className="grow">
                      <span className="ending-row-title">{open ? e.title : '???'}</span>
                      <span className="small muted">{open ? (e.id === ending.id ? 'Vừa mở khoá' : 'Đã mở khoá') : need}</span>
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="story-end-actions">
              <button className="btn btn-primary btn-block" onClick={showResult}>Xem kết quả</button>
              <button className="btn btn-ghost btn-block" onClick={restart}>↻ Chơi lại, thử cái kết khác</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
