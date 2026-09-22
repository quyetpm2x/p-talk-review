export function MicButton({ listening, onClick, disabled }: { listening: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={`mic-btn ${listening ? 'on' : ''}`} onClick={onClick} disabled={disabled}
      aria-label={listening ? 'Dừng nghe' : 'Bấm để nói'}>
      <span aria-hidden>{listening ? '■' : '🎤'}</span>
    </button>
  )
}
