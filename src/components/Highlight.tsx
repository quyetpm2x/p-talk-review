/** Tách câu thành các đoạn thường / đoạn là cụm toolkit. */
export function splitToolkit(text: string, toolkit: string[]): { t: string; k?: number }[] {
  const out: { t: string; k?: number }[] = []
  let rest = text
  const marks = toolkit
    .map((k, idx) => ({ k, idx, at: text.indexOf(k) }))
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at)
  let pos = 0
  for (const m of marks) {
    if (m.at < pos) continue
    if (m.at > pos) out.push({ t: text.slice(pos, m.at) })
    out.push({ t: m.k, k: m.idx })
    pos = m.at + m.k.length
  }
  rest = text.slice(pos)
  if (rest) out.push({ t: rest })
  return out
}

export const Highlight = ({ text, toolkit }: { text: string; toolkit: string[] }) => (
  <>{splitToolkit(text, toolkit).map((s, i) => (s.k !== undefined ? <b key={i}>{s.t}</b> : <span key={i}>{s.t}</span>))}</>
)
