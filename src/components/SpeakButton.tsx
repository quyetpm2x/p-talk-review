import { useState } from 'react'
import { hasTTS, speak, type SpeakOpts } from '../lib/speech'
import { cleanPhrase } from '../lib/scoring'

export function SpeakButton({ text, size, label, ...opts }: { text: string; size?: 'lg'; label?: string } & SpeakOpts) {
  const [playing, setPlaying] = useState(false)
  if (!hasTTS()) return null
  return (
    <button
      type="button"
      className={`speak-btn ${size ?? ''} ${playing ? 'playing' : ''}`}
      aria-label={label ?? `Nghe: ${text}`}
      onClick={(e) => {
        e.stopPropagation()
        setPlaying(true)
        speak(cleanPhrase(text), opts).finally(() => setPlaying(false))
      }}
    >
      {opts.slow ? '🐢' : '🔊'}
    </button>
  )
}
