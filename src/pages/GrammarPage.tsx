import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getLesson } from '../lessons'
import type { GrammarPoint } from '../types'
import { Choices } from '../components/Choices'
import { Feedback } from '../components/Feedback'
import { useProgress } from '../lib/ProgressContext'
import { setBest } from '../lib/progress'
import { fuzzyEqual } from '../lib/scoring'
import { shuffle } from '../lib/shuffle'
import { buzz } from '../lib/haptics'
import { useReward } from '../motivation/useReward'
import { RewardInline } from '../motivation/Reward'
import type { RewardReport } from '../motivation/engine'

export function GrammarPage() {
  const { id = '' } = useParams()
  const lesson = getLesson(id)!
  const [open, setOpen] = useState<number | null>(null)
  const [p] = useProgress()
  return (
    <>
      <div className="section-bar">Ngữ pháp <em>— công cụ (gọn)</em></div>
      {lesson.grammar.map((g, i) => {
        const best = p.bestScores[`${lesson.id}:gram${i}`]
        return (
          <div key={i} className="card stack" style={{ gap: 10 }}>
            <div style={{ fontWeight: 800 }}>{String.fromCharCode(97 + i)}) {g.title}</div>
            <ul className="notes">{g.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            {open === i ? (
              <Exercises key={i} g={g} bestKey={`${lesson.id}:gram${i}`} onClose={() => setOpen(null)} />
            ) : (
              <div className="row">
                <button className="btn btn-dark btn-sm" onClick={() => setOpen(i)}>✏️ Làm bài ({g.exercises.length} câu)</button>
                <span className="grow" />
                {best !== undefined && <span className="tag accent">⭐ {best}/{g.exercises.length}</span>}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

function Exercises({ g, bestKey, onClose }: { g: GrammarPoint; bestKey: string; onClose: () => void }) {
  const [, update] = useProgress()
  const [i, setI] = useState(0)
  const [ok, setOk] = useState<boolean | null>(null)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const [val, setVal] = useState('')
  const give = useReward()
  const [reward, setReward] = useState<RewardReport | null>(null)
  const e = g.exercises[i]
  const opts = useMemo(() => (e.type === 'choice' ? shuffle(e.options.map((o, k) => ({ o, k }))) : []), [e])

  const answer = (right: boolean) => {
    setOk(right)
    buzz(right)
    if (right) setScore((s) => s + 1)
  }
  const next = () => {
    if (i + 1 < g.exercises.length) {
      setI(i + 1)
      setOk(null)
      setVal('')
    } else {
      setFinished(true)
      update((pp) => setBest(pp, bestKey, score))
      setReward(give({ kind: 'grammar', id: bestKey, correct: score, total: g.exercises.length }))
    }
  }

  if (finished)
    return (
      <div className="card-2 center stack">
        <div style={{ fontSize: 36 }}>{score === g.exercises.length ? '🏆' : '👍'}</div>
        <strong>Đúng {score}/{g.exercises.length} câu</strong>
        <RewardInline key={String(!!reward)} report={reward} />
        <div className="grid-2">
          <button className="btn btn-ghost" onClick={onClose}>Đóng</button>
          <button className="btn btn-primary" onClick={() => { setI(0); setOk(null); setScore(0); setVal(''); setReward(null); setFinished(false) }}>↻ Làm lại</button>
        </div>
      </div>
    )

  return (
    <div className="card-2 stack" style={{ gap: 12 }}>
      <div className="row small">
        <span className="muted grow">Câu {i + 1}/{g.exercises.length}</span>
        <span className="score-pill">{score}</span>
      </div>
      <div style={{ fontWeight: 700, fontSize: 18 }} lang="en">{e.q}</div>
      {e.type === 'choice' ? (
        <Choices key={i} options={opts.map((x) => ({ label: x.o }))} correct={opts.findIndex((x) => x.k === e.answer)} onPick={(_, r) => answer(r)} />
      ) : (
        <form className="stack" onSubmit={(ev) => { ev.preventDefault(); if (val.trim() && ok === null) answer(e.answers.some((a) => fuzzyEqual(a, val) === 'exact')) }}>
          <input className="text-input" lang="en" autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
            value={val} disabled={ok !== null} onChange={(ev) => setVal(ev.target.value)} placeholder="Gõ đáp án…" aria-label="Đáp án" />
          {ok === null && <button className="btn btn-primary" disabled={!val.trim()}>Kiểm tra</button>}
        </form>
      )}
      {ok !== null && (
        <>
          <Feedback ok={ok} answer={
            <>
              {e.type === 'input' && <div lang="en">Đáp án: <strong>{e.answers[0]}</strong></div>}
              <div style={{ fontWeight: 400 }}>💡 {e.explain}</div>
            </>
          } />
          <button className="btn btn-primary btn-block" onClick={next}>{i + 1 < g.exercises.length ? 'Câu tiếp →' : 'Xem kết quả'}</button>
        </>
      )}
    </div>
  )
}
