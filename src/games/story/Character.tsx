import type { Gender, Mood } from './data'

const SKIN = '#f6d2b3'
const SKIN_D = '#e8b793'
const HAIR = '#2b1c17'
const INK = '#2a1a14'

/** Nét mặt theo tâm trạng: mắt, lông mày, miệng. */
function Face({ mood }: { mood: Mood }) {
  switch (mood) {
    case 'happy':
      return (
        <g>
          {/* mắt cười híp */}
          <path d="M70 95 Q80 84 90 95" stroke={INK} strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <path d="M110 95 Q120 84 130 95" stroke={INK} strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <path d="M68 76 Q80 68 91 74" stroke={HAIR} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M109 74 Q120 68 132 76" stroke={HAIR} strokeWidth="4" fill="none" strokeLinecap="round" />
          <circle cx="68" cy="110" r="9" fill="#ff8a8a" opacity="0.55" />
          <circle cx="132" cy="110" r="9" fill="#ff8a8a" opacity="0.55" />
          {/* miệng cười tươi */}
          <path d="M80 112 Q100 140 120 112 Z" fill="#8e2b2b" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M89 125 Q100 133 111 125 Q100 120 89 125 Z" fill="#ff7b7b" />
          <path d="M82 113 L118 113" stroke="#fff" strokeWidth="3" />
        </g>
      )
    case 'meh':
      return (
        <g>
          <ellipse cx="81" cy="95" rx="5" ry="5" fill={INK} />
          <ellipse cx="121" cy="95" rx="5" ry="5" fill={INK} />
          {/* một bên mày nhướn */}
          <path d="M69 78 L91 80" stroke={HAIR} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M109 76 Q121 66 133 74" stroke={HAIR} strokeWidth="4" fill="none" strokeLinecap="round" />
          <circle cx="68" cy="110" r="8" fill="#ff8a8a" opacity="0.2" />
          <circle cx="132" cy="110" r="8" fill="#ff8a8a" opacity="0.2" />
          {/* miệng thẳng, hơi lệch */}
          <path d="M87 121 L114 118" stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      )
    case 'awkward':
      return (
        <g>
          {/* mắt tròn xoe */}
          <circle cx="80" cy="95" r="9" fill="#fff" stroke={INK} strokeWidth="2.5" />
          <circle cx="120" cy="95" r="9" fill="#fff" stroke={INK} strokeWidth="2.5" />
          <circle cx="80" cy="96" r="3.5" fill={INK} />
          <circle cx="120" cy="96" r="3.5" fill={INK} />
          {/* mày chau lo lắng */}
          <path d="M68 80 L90 74" stroke={HAIR} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M110 74 L132 80" stroke={HAIR} strokeWidth="4" fill="none" strokeLinecap="round" />
          {/* miệng méo, nhe răng */}
          <rect x="80" y="111" width="40" height="15" rx="6" fill="#fff" stroke={INK} strokeWidth="3" />
          <path d="M80 118.5 L120 118.5 M90 111 L90 126 M100 111 L100 126 M110 111 L110 126" stroke={INK} strokeWidth="1.8" />
          {/* giọt mồ hôi */}
          <path className="sweat" d="M146 66 Q139 78 146 82 Q153 78 146 66 Z" fill="#7cc6ff" stroke="#3f8fd0" strokeWidth="1.5" />
        </g>
      )
    default: // idle + talk
      return (
        <g>
          <ellipse cx="80" cy="95" rx="5.5" ry="6.5" fill={INK} />
          <ellipse cx="120" cy="95" rx="5.5" ry="6.5" fill={INK} />
          <circle cx="82" cy="93" r="1.8" fill="#fff" />
          <circle cx="122" cy="93" r="1.8" fill="#fff" />
          <path d="M69 78 Q80 72 91 77" stroke={HAIR} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M109 77 Q120 72 131 78" stroke={HAIR} strokeWidth="4" fill="none" strokeLinecap="round" />
          <circle cx="68" cy="110" r="8" fill="#ff8a8a" opacity="0.35" />
          <circle cx="132" cy="110" r="8" fill="#ff8a8a" opacity="0.35" />
          {mood === 'talk' ? (
            <ellipse className="talk-mouth" cx="100" cy="119" rx="9" ry="6.5" fill="#8e2b2b" stroke={INK} strokeWidth="3" />
          ) : (
            <path d="M87 116 Q100 127 113 116" stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />
          )}
        </g>
      )
  }
}

/** Nhân vật bạn cũ vẽ bằng SVG — nữ: tóc bob, bông tai; nam: tóc ngắn. Áo len navy cổ vàng. */
export function Character({ mood, look = 'f' }: { mood: Mood; look?: Gender }) {
  const f = look === 'f'
  return (
    <svg className="char-svg" viewBox="0 0 200 210" aria-hidden>
      {/* tóc phía sau */}
      {f && <path d="M40 96 Q36 30 100 26 Q164 30 160 96 L162 150 Q130 160 100 158 Q70 160 38 150 Z" fill={HAIR} />}
      {/* thân */}
      <path d="M22 210 Q24 158 100 150 Q176 158 178 210 Z" fill="#1c2c55" />
      <path d="M78 152 Q100 176 122 152 L118 150 Q100 168 82 150 Z" fill="#c9a04e" />
      <rect x="88" y="126" width="24" height="30" rx="8" fill={SKIN_D} />
      {/* tai */}
      <ellipse cx="50" cy="100" rx="8" ry="11" fill={SKIN_D} />
      <ellipse cx="150" cy="100" rx="8" ry="11" fill={SKIN_D} />
      {f && <circle cx="50" cy="112" r="3" fill="#e0b453" />}
      {f && <circle cx="150" cy="112" r="3" fill="#e0b453" />}
      {/* đầu */}
      <ellipse cx="100" cy="94" rx="50" ry="54" fill={SKIN} />
      {/* mái tóc */}
      {f ? (
        <>
          <path d="M48 88 Q50 40 100 38 Q150 40 152 88 Q138 60 112 58 Q118 70 108 76 Q100 60 84 60 Q62 64 48 88 Z" fill={HAIR} />
          <path d="M96 44 Q112 38 128 46" stroke="#4a3128" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
        </>
      ) : (
        <>
          {/* tóc ngắn, mái vuốt lệch */}
          <path d="M49 92 Q44 42 98 32 Q146 30 153 76 Q154 86 151 92 Q146 70 132 62 Q112 70 90 60 Q70 72 58 68 Q52 78 49 92 Z" fill={HAIR} />
          <path d="M84 42 Q108 32 132 44" stroke="#4a3128" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
        </>
      )}
      <g key={mood} className="face-swap">
        <Face mood={mood} />
      </g>
    </svg>
  )
}

export const MOOD_EMOJI: Partial<Record<Mood, string>> = { happy: '😊', meh: '😐', awkward: '😬' }
