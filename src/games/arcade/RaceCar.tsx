/** Xe đua nhìn từ trên xuống, mũi xe hướng lên (không phụ thuộc emoji của từng máy). */
export function RaceCar({ body, accent }: { body: string; accent: string }) {
  return (
    <svg className="car-body" viewBox="0 0 40 68" aria-hidden focusable="false">
      {/* bánh xe */}
      <rect x="1" y="12" width="8" height="14" rx="3" fill="#111" />
      <rect x="31" y="12" width="8" height="14" rx="3" fill="#111" />
      <rect x="1" y="44" width="8" height="16" rx="3" fill="#111" />
      <rect x="31" y="44" width="8" height="16" rx="3" fill="#111" />
      {/* cánh gió trước + sau */}
      <rect x="5" y="3" width="30" height="5" rx="2" fill={accent} />
      <rect x="6" y="60" width="28" height="6" rx="2" fill={accent} />
      {/* thân xe: mũi nhọn ở trên */}
      <path d="M20 2 C25 8 27 16 28 26 L30 46 C30 56 26 62 20 62 C14 62 10 56 10 46 L12 26 C13 16 15 8 20 2 Z" fill={body} />
      {/* buồng lái + mũ bảo hiểm */}
      <ellipse cx="20" cy="36" rx="6" ry="9" fill="#13203f" />
      <circle cx="20" cy="34" r="3.6" fill={accent} />
      {/* sọc giữa */}
      <rect x="18.5" y="6" width="3" height="20" rx="1.5" fill={accent} opacity="0.9" />
    </svg>
  )
}
