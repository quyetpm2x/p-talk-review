import { useState } from 'react'
import type { Item } from '../lib/picker'
import { SpeakButton } from './SpeakButton'
import { Icon } from './Icon'

type Answer = { item: Item; correct: boolean }

const fmtTime = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}p ${s % 60}s` : `${s}s`)

/** Trang thống kê sau khi làm xong một lượt. */
export function ResultScreen({ score, best, total, correct, wrong, answers, seconds, onRetry, onReviewWrong, onExit, unit = 'điểm' }: {
  score: number; best?: number; total?: number; correct?: number; wrong: Item[]
  answers?: Answer[]; seconds?: number
  onRetry: () => void; onReviewWrong?: () => void; onExit: () => void; unit?: string
}) {
  const isBest = best !== undefined && score >= best && score > 0
  const ratio = total ? (correct ?? 0) / total : 0
  const pct = Math.round(ratio * 100)
  const emoji = !total ? '🏁' : ratio === 1 ? '🏆' : ratio >= 0.7 ? '🎉' : ratio >= 0.4 ? '💪' : '📖'
  const msg = !total ? 'Hoàn thành!' : ratio === 1 ? 'Xuất sắc — đúng tất cả!' : ratio >= 0.7 ? 'Làm tốt lắm!' : ratio >= 0.4 ? 'Khá rồi, ôn thêm chút nữa nhé!' : 'Cần ôn lại — cố lên!'
  const rows: Answer[] = answers ?? wrong.map((item) => ({ item, correct: false }))

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="result-hero">
        <div style={{ fontSize: 48, lineHeight: 1 }}>{emoji}</div>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{msg}</div>
        {total !== undefined && (
          <div className="ring" style={{ ['--pct' as string]: `${pct}` }} role="img" aria-label={`Chính xác ${pct}%`}>
            <div>
              <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{pct}%</div>
              <div className="small" style={{ opacity: 0.75 }}>chính xác</div>
            </div>
          </div>
        )}
        {isBest ? <span className="tag accent">⭐ Kỷ lục mới!</span> : best !== undefined && best > 0 && <span className="small" style={{ opacity: 0.75 }}>Kỷ lục: {best}</span>}
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="stat-v">{score}</div><div className="stat-k">{unit}</div></div>
        {total !== undefined && (
          <>
            <div className="stat"><div className="stat-v" style={{ color: 'var(--ok)' }}>{correct}</div><div className="stat-k">câu đúng</div></div>
            <div className="stat"><div className="stat-v" style={{ color: 'var(--bad)' }}>{total - (correct ?? 0)}</div><div className="stat-k">câu sai</div></div>
          </>
        )}
        {seconds !== undefined && <div className="stat"><div className="stat-v">{fmtTime(seconds)}</div><div className="stat-k">thời gian</div></div>}
      </div>

      {rows.length > 0 && <AnswerList rows={rows} detailed={!!answers} />}

      <div className="stack">
        {onReviewWrong && wrong.length > 0 && (
          <button className="btn btn-primary btn-block" onClick={onReviewWrong}>Làm lại {wrong.length} câu sai</button>
        )}
        <button className={`btn btn-block ${onReviewWrong && wrong.length ? 'btn-dark' : 'btn-primary'}`} onClick={onRetry}>Chơi lượt mới</button>
        <button className="btn btn-ghost btn-block" onClick={onExit}>Về danh sách trò</button>
      </div>
    </div>
  )
}

type Filter = 'all' | 'bad' | 'ok'

function AnswerList({ rows, detailed }: { rows: Answer[]; detailed: boolean }) {
  const nBad = rows.filter((r) => !r.correct).length
  const nOk = rows.length - nBad
  const [filter, setFilter] = useState<Filter>(detailed && nBad ? 'bad' : 'all')
  const shown = rows
    .map((r, i) => ({ ...r, n: i + 1 }))
    .filter((r) => filter === 'all' || (filter === 'ok' ? r.correct : !r.correct))
  const tabs: { id: Filter; label: string; n: number }[] = [
    { id: 'all', label: 'Tất cả', n: rows.length },
    { id: 'bad', label: 'Sai', n: nBad },
    { id: 'ok', label: 'Đúng', n: nOk },
  ]
  return (
    <section className="answers">
      <div className="answers-head">
        <div className="label">{detailed ? 'Chi tiết từng câu' : 'Cần ôn lại'}</div>
        {detailed && (
          <div className="seg" role="tablist" aria-label="Lọc câu">
            {tabs.map((t) => (
              <button key={t.id} role="tab" aria-selected={filter === t.id} className={filter === t.id ? 'on' : ''}
                onClick={() => setFilter(t.id)} disabled={!t.n && t.id !== 'all'}>
                {t.label} <span className="seg-n">{t.n}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <ol className="answer-list">
        {shown.map((a) => (
          <li key={a.n} className={a.correct ? 'ok' : 'bad'}>
            <span className="answer-n">{a.n}</span>
            <div className="grow">
              <div className="answer-en" lang="en">{a.item.en}</div>
              <div className="answer-vi">{a.item.vi}</div>
            </div>
            <span className={`mark ${a.correct ? 'ok' : 'bad'}`} aria-label={a.correct ? 'Đúng' : 'Sai'}>
              <Icon name={a.correct ? 'check' : 'x'} size={14} stroke={3} />
            </span>
            <SpeakButton text={a.item.en} size="sm" />
          </li>
        ))}
        {!shown.length && <li className="answer-empty">Không có câu nào 🎉</li>}
      </ol>
    </section>
  )
}
