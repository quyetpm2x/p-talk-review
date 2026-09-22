import { useState } from 'react'

export type Choice = { label: string; sub?: string }

/** Danh sách đáp án; sau khi chọn thì khoá và tô đúng/sai. */
export function Choices({ options, correct, onPick, lang }: {
  options: Choice[]
  correct: number
  onPick: (index: number, isCorrect: boolean) => void
  lang?: string
}) {
  const [picked, setPicked] = useState<number | null>(null)
  return (
    <div className="choices">
      {options.map((o, i) => {
        let cls = 'choice'
        if (picked !== null) {
          if (i === correct) cls += ' ok'
          else if (i === picked) cls += ' bad'
          else cls += ' dim'
        }
        return (
          <button
            key={i}
            className={cls}
            disabled={picked !== null}
            lang={lang}
            onClick={() => {
              setPicked(i)
              onPick(i, i === correct)
            }}
          >
            <span className="key">{String.fromCharCode(65 + i)}</span>
            <span className="grow">
              {o.label}
              {o.sub && <div className="muted small">{o.sub}</div>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
