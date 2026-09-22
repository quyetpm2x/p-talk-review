export type BossMood = 'idle' | 'hurt' | 'attack' | 'dead'

/** Con boss "Quỷ Im Lặng": cục tím có sừng đỏ, dễ thương nhưng hầm hố. Vẽ bằng SVG. */
export function BossSprite({ mood }: { mood: BossMood }) {
  const hurt = mood === 'hurt'
  const angry = mood === 'attack'
  return (
    <svg viewBox="0 0 200 200" className="boss-svg" role="img" aria-label="Boss Quỷ Im Lặng">
      <defs>
        <radialGradient id="bossBody" cx="42%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#b98cff" />
          <stop offset="55%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#4c1d95" />
        </radialGradient>
        <linearGradient id="bossHorn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffb3a7" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
        <radialGradient id="bossBelly" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#e9d5ff" />
          <stop offset="100%" stopColor="#c4a3f7" />
        </radialGradient>
      </defs>

      {/* bóng dưới chân */}
      <ellipse cx="100" cy="188" rx="58" ry="8" fill="rgba(0,0,0,0.35)" />

      {/* sừng */}
      <path d="M58 62 C 44 40, 40 22, 50 8 C 58 26, 70 38, 80 48 Z" fill="url(#bossHorn)" stroke="#7f1d1d" strokeWidth="3" strokeLinejoin="round" />
      <path d="M142 62 C 156 40, 160 22, 150 8 C 142 26, 130 38, 120 48 Z" fill="url(#bossHorn)" stroke="#7f1d1d" strokeWidth="3" strokeLinejoin="round" />

      {/* tay vuốt */}
      <g className="boss-arm-l">
        <path d="M34 118 C 14 112, 8 128, 18 138 C 24 144, 34 140, 40 134 Z" fill="#6d28d9" stroke="#2e1065" strokeWidth="3" />
        <path d="M14 128 l-6 -4 M16 136 l-7 1" stroke="#fecdd3" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g className="boss-arm-r">
        <path d="M166 118 C 186 112, 192 128, 182 138 C 176 144, 166 140, 160 134 Z" fill="#6d28d9" stroke="#2e1065" strokeWidth="3" />
        <path d="M186 128 l6 -4 M184 136 l7 1" stroke="#fecdd3" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* thân */}
      <path
        d="M100 40 C 150 40, 172 78, 170 118 C 168 158, 142 182, 100 182 C 58 182, 32 158, 30 118 C 28 78, 50 40, 100 40 Z"
        fill="url(#bossBody)" stroke="#2e1065" strokeWidth="4"
      />
      {/* chân */}
      <path d="M66 176 q0 12 12 12 h8 q6 0 6 -8" fill="#5b21b6" stroke="#2e1065" strokeWidth="3" />
      <path d="M134 176 q0 12 -12 12 h-8 q-6 0 -6 -8" fill="#5b21b6" stroke="#2e1065" strokeWidth="3" />
      {/* bụng */}
      <ellipse cx="100" cy="140" rx="40" ry="30" fill="url(#bossBelly)" opacity="0.55" />
      {/* gai lưng/đỉnh đầu */}
      <path d="M86 42 l6 -12 l6 12 M102 41 l6 -13 l6 13" fill="#e11d48" stroke="#7f1d1d" strokeWidth="2.5" strokeLinejoin="round" />

      {/* má hồng */}
      <ellipse cx="58" cy="116" rx="11" ry="6" fill="#fb7185" opacity={hurt ? 0.9 : 0.55} />
      <ellipse cx="142" cy="116" rx="11" ry="6" fill="#fb7185" opacity={hurt ? 0.9 : 0.55} />

      {/* mắt */}
      {hurt ? (
        <g stroke="#1e1b4b" strokeWidth="6" strokeLinecap="round" fill="none">
          <path d="M60 84 l18 10 l-18 10" />
          <path d="M140 84 l-18 10 l18 10" />
        </g>
      ) : (
        <g>
          <ellipse cx="72" cy="94" rx="17" ry={angry ? 13 : 18} fill="#fff" stroke="#1e1b4b" strokeWidth="3" />
          <ellipse cx="128" cy="94" rx="17" ry={angry ? 13 : 18} fill="#fff" stroke="#1e1b4b" strokeWidth="3" />
          <circle cx={angry ? 76 : 75} cy="97" r={angry ? 6 : 8} fill="#dc2626" />
          <circle cx={angry ? 124 : 125} cy="97" r={angry ? 6 : 8} fill="#dc2626" />
          <circle cx="77" cy="94" r="2.6" fill="#fff" />
          <circle cx="127" cy="94" r="2.6" fill="#fff" />
        </g>
      )}
      {/* lông mày giận */}
      <path d={angry ? 'M50 70 L90 84' : 'M52 72 L88 80'} stroke="#1e1b4b" strokeWidth="7" strokeLinecap="round" />
      <path d={angry ? 'M150 70 L110 84' : 'M148 72 L112 80'} stroke="#1e1b4b" strokeWidth="7" strokeLinecap="round" />

      {/* miệng */}
      {hurt ? (
        <g>
          <path d="M78 128 q22 -14 44 0 q-4 22 -22 22 q-18 0 -22 -22 Z" fill="#3b0764" stroke="#1e1b4b" strokeWidth="3" />
          <path d="M90 142 q10 -6 20 0" fill="#fb7185" />
        </g>
      ) : angry ? (
        <g>
          <path d="M66 122 q34 34 68 0 Z" fill="#3b0764" stroke="#1e1b4b" strokeWidth="3" strokeLinejoin="round" />
          <path d="M72 124 l6 10 l6 -8 l6 10 l6 -9 l6 10 l6 -9 l6 10 l6 -8 l6 10 l4 -10" fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
        </g>
      ) : (
        <g>
          <path d="M72 124 q28 22 56 0" fill="none" stroke="#1e1b4b" strokeWidth="5" strokeLinecap="round" />
          <path d="M80 128 l5 11 l5 -8 Z M120 128 l-5 11 l-5 -8 Z" fill="#fff" stroke="#1e1b4b" strokeWidth="2" strokeLinejoin="round" />
        </g>
      )}
    </svg>
  )
}
