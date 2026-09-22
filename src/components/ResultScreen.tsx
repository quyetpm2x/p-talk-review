import type { Item } from '../lib/picker'
import { SpeakButton } from './SpeakButton'

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

      {rows.length > 0 && (
        <div className="card stack" style={{ gap: 0, padding: 0 }}>
          <div className="label" style={{ padding: '12px 14px 8px' }}>
            {answers ? 'Chi tiết từng câu' : `Cần ôn lại (${rows.length})`}
          </div>
          {rows.map((a, k) => (
            <div key={k} className="row" style={{ padding: '10px 14px', borderTop: '1px solid var(--line)' }}>
              <span className={`mark ${a.correct ? 'ok' : 'bad'}`} aria-label={a.correct ? 'Đúng' : 'Sai'}>{a.correct ? '✓' : '✕'}</span>
              <div className="grow">
                <div style={{ fontWeight: 600 }} lang="en">{a.item.en}</div>
                <div className="muted small">{a.item.vi}</div>
              </div>
              <SpeakButton text={a.item.en} />
            </div>
          ))}
        </div>
      )}

      <div className="stack">
        {onReviewWrong && wrong.length > 0 && (
          <button className="btn btn-primary btn-block" onClick={onReviewWrong}>🩹 Làm lại {wrong.length} câu sai</button>
        )}
        <button className={`btn btn-block ${onReviewWrong && wrong.length ? 'btn-dark' : 'btn-primary'}`} onClick={onRetry}>↻ Chơi lượt mới</button>
        <button className="btn btn-ghost btn-block" onClick={onExit}>Về danh sách trò</button>
      </div>
    </div>
  )
}
