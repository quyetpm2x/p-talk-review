import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiLogin, apiRegister, ApiError, type AuthResult } from '../lib/api'
import { useSession } from '../lib/auth'
import { finishSignOut, signIn, signOut, useSyncStatus, type SyncStatus } from '../lib/sync'
import { greeting } from '../lib/name'
import { Mascot } from '../motivation/Mascot'
import { UserName } from '../components/UserName'
import { sfx } from '../lib/sfx'
import '../styles/motivation.css'
import '../styles/welcome.css'

type Mode = 'login' | 'register'

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="auth-field">
      <label className="name-label" htmlFor={id}>{label}</label>
      {children}
    </div>
  )
}

/** Màn mở app khi chưa đăng nhập: Đăng nhập / Tạo tài khoản. Xong thì chào tên rồi vào Trang chủ. */
export function Welcome() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [form, setForm] = useState({ name: '', username: '', password: '', classCode: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [leaving, setLeaving] = useState<string | null>(null)
  const hi = greeting(new Date().getHours())
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')
    if (mode === 'register' && !form.name.trim()) return setError('Vui lòng nhập họ và tên')
    if (!form.username.trim() || !form.password) return setError('Vui lòng nhập tên đăng nhập và mật khẩu')
    if (mode === 'register' && !form.classCode.trim()) return setError('Vui lòng nhập mã lớp giáo viên đã cấp')
    setBusy(true)
    try {
      const r: AuthResult = mode === 'login'
        ? await apiLogin({ username: form.username, password: form.password })
        : await apiRegister(form)
      await signIn(r) // tải + gộp tiến độ rồi mới vào app
      sfx('ok')
      setLeaving(r.user.name)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Có lỗi xảy ra, thử lại nhé')
      sfx('bad')
    } finally {
      setBusy(false)
    }
  }

  // Chào tên một nhịp rồi vào Trang chủ
  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(() => navigate('/', { replace: true }), 1400)
    return () => clearTimeout(t)
  }, [leaving, navigate])

  const switchMode = (m: Mode) => { setMode(m); setError('') }

  return (
    <main className={`welcome ${leaving ? 'leaving' : ''}`}>
      <div className="welcome-card">
        <Mascot mood={leaving ? 'dance' : error ? 'think' : 'cheer'} size={104} />
        {leaving ? (
          <div className="welcome-hi" role="status">
            <div className="welcome-title">{hi}, <UserName name={leaving} />! 🎉</div>
            <p>Cùng ôn bài thôi nào!</p>
          </div>
        ) : (
          <>
            <div className="welcome-title">Chào mừng đến với <span className="gold-text">PTALK</span>!</div>
            <div className="auth-tabs" role="tablist">
              <button role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => switchMode('login')}>Đăng nhập</button>
              <button role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'on' : ''} onClick={() => switchMode('register')}>Tạo tài khoản</button>
            </div>
            <form className="name-form on-dark auth-form" onSubmit={submit} noValidate>
              {mode === 'register' && (
                <Field id="f-name" label="Họ và tên">
                  <input id="f-name" className="name-input" value={form.name} onChange={set('name')} maxLength={40}
                    placeholder="VD: Nguyễn Bảo An" autoComplete="name" />
                </Field>
              )}
              <Field id="f-user" label="Tên đăng nhập">
                <input id="f-user" className="name-input" value={form.username} onChange={set('username')} maxLength={20}
                  placeholder="VD: baoan.2014" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
              </Field>
              <Field id="f-pass" label="Mật khẩu">
                <input id="f-pass" className="name-input" type="password" value={form.password} onChange={set('password')} maxLength={72}
                  placeholder={mode === 'register' ? 'Ít nhất 6 ký tự' : ''} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
              </Field>
              {mode === 'register' && (
                <Field id="f-class" label="Mã lớp">
                  <input id="f-class" className="name-input" value={form.classCode} onChange={set('classCode')} maxLength={20}
                    placeholder="Giáo viên cấp, VD: L2-T7" autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
                </Field>
              )}
              <div className="auth-error" role="alert" aria-live="polite">{error}</div>
              <button className="btn btn-primary btn-block name-go" type="submit" disabled={busy}>
                {busy ? 'Đang kết nối…' : mode === 'login' ? 'Đăng nhập →' : 'Tạo tài khoản →'}
              </button>
              {mode === 'login' && <p className="auth-note">Quên mật khẩu? Liên hệ giáo viên của bạn nhé.</p>}
            </form>
          </>
        )}
      </div>
    </main>
  )
}

const STATUS: Record<SyncStatus, [string, string]> = {
  synced: ['☁️', 'Đã lưu lên máy chủ'],
  syncing: ['🔄', 'Đang đồng bộ…'],
  pending: ['⏳', 'Đang chờ lưu lên máy chủ'],
  offline: ['📴', 'Chưa có mạng — sẽ tự lưu khi có mạng lại'],
  'signed-out': ['🔒', 'Chưa đăng nhập'],
}

/** Sheet tài khoản (mở từ Trang chủ): tên, lớp, trạng thái đồng bộ, đăng xuất. */
export function AccountSheet({ onClose }: { onClose: () => void }) {
  const session = useSession()
  const status = useSyncStatus()
  const [busy, setBusy] = useState(false)
  const [confirmLose, setConfirmLose] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const logout = async () => {
    if (confirmLose) { finishSignOut(); onClose(); return }
    setBusy(true)
    const r = await signOut()
    setBusy(false)
    if (r === 'unsynced') setConfirmLose(true)
    else onClose()
  }
  const [icon, text] = STATUS[status]

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Tài khoản" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden />
        <div className="row">
          <div className="sheet-title grow">👤 Tài khoản</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Đóng</button>
        </div>
        {session && (
          <dl className="acct">
            <dt>Họ và tên</dt><dd>{session.user.name}</dd>
            <dt>Tên đăng nhập</dt><dd>{session.user.username}</dd>
            <dt>Lớp</dt><dd>{session.user.classCode}</dd>
          </dl>
        )}
        <div className={`acct-sync ${status}`} role="status">{icon} {text}</div>
        {confirmLose && (
          <p className="acct-warn" role="alert">
            Máy đang mất mạng nên tiến độ gần đây <b>chưa được lưu lên máy chủ</b>. Đăng xuất bây giờ sẽ mất phần này.
          </p>
        )}
        <button className={`btn btn-block ${confirmLose ? 'btn-danger' : 'btn-ghost'}`} onClick={logout} disabled={busy}>
          {busy ? 'Đang lưu…' : confirmLose ? 'Vẫn đăng xuất' : 'Đăng xuất'}
        </button>
      </div>
    </div>
  )
}
