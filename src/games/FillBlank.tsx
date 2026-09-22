import { useState } from 'react'
import type { QuestionProps } from './types'
import { blankOf, fuzzyEqual } from '../lib/scoring'
import { Feedback } from '../components/Feedback'
import { buzz } from '../lib/haptics'
import { speak } from '../lib/speech'
import { cleanPhrase } from '../lib/scoring'

export function FillBlank({ item, onAnswer }: QuestionProps) {
  const blank = blankOf(item)
  const at = item.en.indexOf(blank)
  const [val, setVal] = useState('')
  const [res, setRes] = useState<'exact' | 'near' | 'wrong' | null>(null)

  const submit = () => {
    if (!val.trim() || res) return
    const r = fuzzyEqual(blank, val)
    setRes(r)
    const ok = r !== 'wrong'
    buzz(ok)
    speak(cleanPhrase(item.en))
    onAnswer({ correct: ok, points: r === 'exact' ? 15 : r === 'near' ? 8 : 0 })
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="q-label">Gõ từ còn thiếu</div>
      <div className="card stack" style={{ gap: 8 }}>
        <div className="prompt" lang="en">
          {item.en.slice(0, at)}
          <span style={{ borderBottom: '3px solid var(--accent)', padding: '0 4px', color: res ? 'var(--fg)' : 'transparent' }}>
            {res ? blank : blank.replace(/./g, '_')}
          </span>
          {item.en.slice(at + blank.length)}
        </div>
        <div className="muted">{item.vi}</div>
        <div className="muted small">Gợi ý: {blank.length} chữ cái, bắt đầu bằng “{blank[0]}”</div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); submit() }} className="stack">
        <input className="text-input" lang="en" autoFocus autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
          placeholder="Gõ từ vào đây…" value={val} disabled={!!res} onChange={(e) => setVal(e.target.value)} aria-label="Từ còn thiếu" />
        {!res && <button className="btn btn-primary btn-block" disabled={!val.trim()}>Kiểm tra</button>}
      </form>
      {res && (
        <Feedback ok={res !== 'wrong'} near={res === 'near'}
          answer={<span lang="en">Đáp án: <strong>{blank}</strong>{res === 'near' && <> (bạn gõ “{val.trim()}”)</>}</span>} />
      )}
    </div>
  )
}
