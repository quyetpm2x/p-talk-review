export const ProgressBar = ({ value, label }: { value: number; label?: string }) => (
  <div className="pbar" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
    <div style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
)
