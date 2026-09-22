import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProgress } from '../lib/ProgressContext'
import { setName } from '../lib/progress'
import { cleanName, greeting, nameError, NAME_MAX } from '../lib/name'
import { Mascot } from '../motivation/Mascot'
import { sfx } from '../lib/sfx'
import '../styles/motivation.css'
import '../styles/welcome.css'

/** Ô nhập tên dùng chung cho màn chào mừng và sheet đổi tên. */
function NameForm({ initial = '', cta, onDone, dark }: { initial?: string; cta: string; onDone: (name: string) => void; dark?: boolean }) {
  const [value, setValue] = useState(initial)
  const [touched, setTouched] = useState(false)
  const err = nameError(value)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!err) onDone(cleanName(value))
  }
  return (
    <form className={`name-form ${dark ? 'on-dark' : ''}`} onSubmit={submit} noValidate>
      <label className="name-label" htmlFor="name-input">Tên hoặc biệt danh</label>
      <input id="name-input" className="name-input" value={value} maxLength={NAME_MAX + 10}
        onChange={(e) => setValue(e.target.value)} onBlur={() => value && setTouched(true)}
        placeholder="VD: Quyết, Bé Na…" autoComplete="given-name" enterKeyHint="go"
        aria-invalid={touched && !!err} aria-describedby="name-hint" />
      <div id="name-hint" className={`name-hint ${touched && err ? 'bad' : ''}`} aria-live="polite">
        {touched && err ? err : !err ? <>Cú sẽ gọi bạn: <b>{cleanName(value)}</b> 👋</> : 'Tên chỉ lưu trên máy này.'}
      </div>
      <button className="btn btn-primary btn-block name-go" type="submit">{cta}</button>
    </form>
  )
}

/** Màn chào mừng lần đầu mở app: hỏi tên rồi mới vào Trang chủ. */
export function Welcome() {
  const [, update] = useProgress()
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState<string | null>(null)
  const hi = greeting(new Date().getHours())

  const done = (name: string) => {
    sfx('ok')
    setLeaving(name)
  }
  // Chào tên vừa nhập một nhịp rồi mới vào Trang chủ
  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(() => {
      navigate('/', { replace: true }) // nhập tên xong luôn vào Trang chủ
      update((p) => setName(p, leaving))
    }, 1400)
    return () => clearTimeout(t)
  }, [leaving, update, navigate])

  return (
    <main className={`welcome ${leaving ? 'leaving' : ''}`}>
      <div className="welcome-card">
        <Mascot mood={leaving ? 'dance' : 'cheer'} size={112} />
        {leaving ? (
          <div className="welcome-hi" role="status">
            <div className="welcome-title">{hi}, <span className="gold-text">{leaving}</span>! 🎉</div>
            <p>Cùng ôn bài thôi nào!</p>
          </div>
        ) : (
          <>
            <div className="welcome-title">Chào mừng đến với <span className="gold-text">PTALK</span>!</div>
            <p className="welcome-sub">Mình là <b>Cú PTALK</b> — bạn đồng hành ôn bài của bạn. Cú nên gọi bạn là gì nhỉ?</p>
            <NameForm cta="Bắt đầu học →" onDone={done} dark />
          </>
        )}
      </div>
    </main>
  )
}

/** Sheet đổi tên (mở từ Trang chủ). */
export function NameSheet({ onClose }: { onClose: () => void }) {
  const [p, update] = useProgress()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Đổi tên" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden />
        <div className="row">
          <div className="sheet-title grow">✏️ Đổi tên</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Đóng</button>
        </div>
        <NameForm initial={p.name} cta="Lưu tên" onDone={(n) => { update((pp) => setName(pp, n)); onClose() }} />
      </div>
    </div>
  )
}
