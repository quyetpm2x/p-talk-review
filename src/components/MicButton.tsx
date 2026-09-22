import { Icon } from './Icon'

export function MicButton({ listening, onClick, disabled }: { listening: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={`mic-btn ${listening ? 'on' : ''}`} onClick={onClick} disabled={disabled}
      aria-label={listening ? 'Dừng nghe' : 'Bấm để nói'}>
      <Icon name={listening ? 'stop' : 'mic'} size={34} />
    </button>
  )
}
