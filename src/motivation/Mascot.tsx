import type { ReactNode } from 'react'
import '../styles/motivation.css'

export type Mood = 'idle' | 'cheer' | 'sad' | 'dance' | 'think'

const NAVY = '#13203f'
const NAVY_2 = '#22335f'
const GOLD = '#c9a04e'
const GOLD_HI = '#ecd08f'
const CREAM = '#f7ecd4'

/** Mắt theo trạng thái. */
function Eyes({ mood }: { mood: Mood }) {
  if (mood === 'cheer' || mood === 'dance')
    return (
      <g stroke={NAVY} strokeWidth={4} strokeLinecap="round" fill="none">
        <path d="M38 53 Q46 42 54 53" />
        <path d="M66 53 Q74 42 82 53" />
      </g>
    )
  const look = mood === 'think' ? { x: 3, y: -4 } : mood === 'sad' ? { x: 0, y: 3 } : { x: 1, y: 1 }
  return (
    <g className="owl-eyes">
      {[46, 74].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={50} r={11} fill="#fff" />
          <circle cx={cx + look.x} cy={50 + look.y} r={5.8} fill={NAVY} />
          <circle cx={cx + look.x + 2.2} cy={50 + look.y - 2.4} r={2} fill="#fff" />
        </g>
      ))}
      {mood === 'sad' && (
        <g>
          {/* mí mắt cụp xuống */}
          <path d="M34 47 Q46 36 58 45 L58 38 L34 38 Z" fill={CREAM} />
          <path d="M62 45 Q74 36 86 47 L86 38 L62 38 Z" fill={CREAM} />
          <path d="M35 39 L55 44" stroke={NAVY} strokeWidth={3} strokeLinecap="round" />
          <path d="M85 39 L65 44" stroke={NAVY} strokeWidth={3} strokeLinecap="round" />
        </g>
      )}
    </g>
  )
}

/** Linh vật PTALK: chú cú mặc vest vàng (SVG inline, animation bằng CSS). */
export function Mascot({ mood = 'idle', size = 96, label }: { mood?: Mood; size?: number; label?: string }) {
  return (
    <svg className={`owl owl--${mood}`} width={size} height={size * (130 / 120)} viewBox="0 0 120 130"
      role="img" aria-label={label ?? 'Cú PTALK'}>
      <g className="owl-all">
        {/* chân */}
        <g fill={GOLD}>
          <ellipse cx={48} cy={122} rx={8} ry={4} />
          <ellipse cx={72} cy={122} rx={8} ry={4} />
        </g>
        {/* cánh */}
        <path className="owl-wing owl-wing-l" d="M26 64 C8 76 10 104 28 112 C30 96 32 80 30 66 Z" fill={NAVY_2} stroke={GOLD} strokeWidth={2} />
        <path className="owl-wing owl-wing-r" d="M94 64 C112 76 110 104 92 112 C90 96 88 80 90 66 Z" fill={NAVY_2} stroke={GOLD} strokeWidth={2} />
        {/* thân + tai */}
        <path d="M30 40 L24 14 L48 30 Q60 26 72 30 L96 14 L90 40 Q100 56 98 80 Q96 118 60 120 Q24 118 22 80 Q20 56 30 40 Z"
          fill={NAVY} stroke={GOLD} strokeWidth={2.5} strokeLinejoin="round" />
        {/* áo sơ mi + vest vàng */}
        <path d="M34 80 Q34 114 60 116 Q86 114 86 80 Q84 70 74 68 L60 98 L46 68 Q36 70 34 80 Z" fill={GOLD} />
        <path d="M46 68 L60 98 L74 68 Q60 64 46 68 Z" fill={CREAM} />
        <path d="M40 80 Q42 96 52 106" stroke={GOLD_HI} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.8} />
        <circle cx={60} cy={104} r={2.4} fill={NAVY} />
        <circle cx={60} cy={112} r={2.4} fill={NAVY} />
        {/* nơ */}
        <path d="M60 72 L50 67 L50 77 Z M60 72 L70 67 L70 77 Z" fill={NAVY} />
        <circle cx={60} cy={72} r={2.6} fill={GOLD} />
        {/* mặt */}
        <circle cx={46} cy={50} r={16} fill={CREAM} />
        <circle cx={74} cy={50} r={16} fill={CREAM} />
        <Eyes mood={mood} />
        <circle cx={34} cy={62} r={4} fill="#f2a7a0" opacity={0.45} />
        <circle cx={86} cy={62} r={4} fill="#f2a7a0" opacity={0.45} />
        {/* mỏ */}
        <path d={mood === 'sad' ? 'M55 60 L65 60 L60 69 Z' : 'M54 58 L66 58 L60 68 Z'} fill={GOLD} stroke="#a97d35" strokeWidth={1} strokeLinejoin="round" />
        {mood === 'sad' && <path className="owl-tear" d="M36 64 Q33 70 36 72 Q39 70 36 64 Z" fill="#7cc4f0" />}
      </g>
      {mood === 'think' && (
        <g className="owl-think" fill={GOLD}>
          <circle cx={100} cy={30} r={3} />
          <circle cx={108} cy={20} r={4} />
          <circle cx={114} cy={8} r={5} />
        </g>
      )}
      {mood === 'dance' && (
        <g className="owl-spark" fill={GOLD_HI}>
          <path d="M10 20 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" />
          <path d="M106 44 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" />
          <path d="M104 100 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5z" />
        </g>
      )}
    </svg>
  )
}

/** Linh vật kèm bong bóng lời nói. */
export function MascotSay({ mood, children, size = 84, dark }: { mood: Mood; children: ReactNode; size?: number; dark?: boolean }) {
  return (
    <div className={`mascot-say ${dark ? 'on-dark' : ''}`}>
      <Mascot mood={mood} size={size} />
      <div className="say-bubble" role="status">{children}</div>
    </div>
  )
}

/** Trạng thái linh vật theo tỉ lệ đúng. */
export function moodFor(ratio: number | undefined): Mood {
  if (ratio === undefined) return 'cheer'
  if (ratio >= 1) return 'dance'
  if (ratio >= 0.7) return 'cheer'
  if (ratio >= 0.55) return 'idle'
  if (ratio >= 0.4) return 'think'
  return 'sad'
}
