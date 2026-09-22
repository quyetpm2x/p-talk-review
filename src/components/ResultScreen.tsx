import type { Item } from '../lib/picker'
import { SpeakButton } from './SpeakButton'

export function ResultScreen({ score, best, total, correct, wrong, onRetry, onReviewWrong, onExit, unit = 'điểm' }: {
  score: number; best?: number; total?: number; correct?: number; wrong: Item[]
  onRetry: () => void; onReviewWrong?: () => void; onExit: () => void; unit?: string
}) {
  const isBest = best !== undefined && score >= best && score > 0
  const ratio = total ? (correct ?? 0) / total : 0
  const emoji = !total ? '🏁' : ratio === 1 ? '🏆' : ratio >= 0.7 ? '🎉' : ratio >= 0.4 ? '💪' : '📖'
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="card center stack" style={{ padding: 24, gap: 6 }}>
        <div style={{ fontSize: 52 }}>{emoji}</div>
        <div className="label">Kết quả</div>
        <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>
          {score} <span style={{ fontSize: 16, fontWeight: 600 }}>{unit}</span>
        </div>
        {total !== undefined && <div className="muted">Đúng {correct}/{total} câu</div>}
        {isBest ? <div><span className="tag accent">⭐ Kỷ lục mới!</span></div> : best !== undefined && best > 0 && <div className="muted small">Kỷ lục: {best}</div>}
      </div>
      {wrong.length > 0 && (
        <div className="card stack">
          <div className="label">Cần ôn lại ({wrong.length})</div>
          {wrong.map((w) => (
            <div key={w.id} className="row">
              <div className="grow">
                <div style={{ fontWeight: 600 }} lang="en">{w.en}</div>
                <div className="muted small">{w.vi}</div>
              </div>
              <SpeakButton text={w.en} />
            </div>
          ))}
        </div>
      )}
      <div className="stack">
        <button className="btn btn-primary btn-block" onClick={onRetry}>↻ Chơi lại</button>
        {onReviewWrong && wrong.length > 0 && (
          <button className="btn btn-dark btn-block" onClick={onReviewWrong}>Ôn {wrong.length} câu sai</button>
        )}
        <button className="btn btn-ghost btn-block" onClick={onExit}>Về danh sách</button>
      </div>
    </div>
  )
}
