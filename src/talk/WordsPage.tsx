import { useMemo, useState } from 'react'
import { TopBar } from '../components/TopBar'
import { useProgress } from '../lib/ProgressContext'
import { applyAnswer, isDue } from '../lib/leitner'
import { speak } from '../lib/speech'
import { buzz } from '../lib/haptics'
import { removeWord, vocabStatKey } from './words'
import './talk.css'

/** Sổ từ của tôi: từ mới từ Luyện nói với Cú, ôn theo Leitner (đến hạn mới hiện). */
export function WordsPage() {
  const [p, update] = useProgress()
  const now = Date.now()
  const list = useMemo(() => Object.entries(p.words).sort((a, b) => b[1].added - a[1].added), [p.words])
  const due = list.filter(([k]) => isDue(p.phrases[vocabStatKey(k)], now))
  const [review, setReview] = useState<string[] | null>(null)
  const [flip, setFlip] = useState(false)
  const cur = review?.[0]
  const w = cur ? p.words[cur] : undefined

  const answer = (ok: boolean) => {
    if (!cur) return
    buzz(ok)
    update((pp) => ({ ...pp, phrases: { ...pp.phrases, [vocabStatKey(cur)]: applyAnswer(pp.phrases[vocabStatKey(cur)], ok, Date.now()) } }))
    setFlip(false)
    setReview((r) => (r ? (ok ? r.slice(1) : [...r.slice(1), r[0]]) : r))
  }

  return (
    <>
      <TopBar back="/" title="Sổ từ của tôi" sub={`${list.length} từ · ${due.length} từ đến hạn ôn`} />
      <main className="page words-page">
        {review ? (
          cur && w ? (
            <>
              <p className="center"><small>Còn {review.length} từ — chạm thẻ để xem nghĩa</small></p>
              <button className="w-card" onClick={() => { setFlip(true); speak(w.en) }}>
                <span className="en">{w.en}</span>
                {flip ? <span className="vi">{w.vi}</span> : <small>🔊 chạm để nghe và xem nghĩa</small>}
              </button>
              {flip && (
                <div className="row">
                  <button className="btn btn-ghost grow" onClick={() => answer(false)}>Chưa nhớ</button>
                  <button className="btn btn-primary grow" onClick={() => answer(true)}>Nhớ rồi ✓</button>
                </div>
              )}
            </>
          ) : (
            <div className="card center"><p>🎉 Đã ôn xong các từ đến hạn!</p><button className="btn btn-primary" onClick={() => setReview(null)}>Về Sổ từ</button></div>
          )
        ) : (
          <>
            {list.length === 0 ? (
              <div className="card"><p>Chưa có từ nào. Khi luyện nói với Cú, từ mới và câu được sửa sẽ tự lưu vào đây.</p></div>
            ) : (
              <button className="btn btn-primary btn-block" disabled={!due.length} onClick={() => { setReview(due.map(([k]) => k)); setFlip(false) }}>
                {due.length ? `Ôn ${due.length} từ đến hạn` : 'Chưa có từ đến hạn ôn — quay lại sau nhé'}
              </button>
            )}
            {list.map(([k, v]) => (
              <div key={k} className="w-item">
                <button className="tb-side" style={{ width: 40, height: 40, fontSize: 16 }} onClick={() => speak(v.en)} aria-label={`Nghe ${v.en}`}>🔊</button>
                <div className="grow"><b>{v.en}</b><small>{v.vi}</small></div>
                <span className="w-box">Hộp {p.phrases[vocabStatKey(k)]?.box ?? 0}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => update((pp) => removeWord(pp, k))} aria-label={`Xoá ${v.en}`}>✕</button>
              </div>
            ))}
          </>
        )}
      </main>
    </>
  )
}
