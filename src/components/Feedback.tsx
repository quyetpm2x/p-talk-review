import type { ReactNode } from 'react'
import { SpeakButton } from './SpeakButton'

/** Khung báo đúng/sai kèm đáp án đúng. */
export function Feedback({ ok, near, answer, speakText, children }: {
  ok: boolean; near?: boolean; answer?: ReactNode; speakText?: string; children?: ReactNode
}) {
  return (
    <div className={`feedback ${ok ? 'ok' : 'bad'}`} role="status">
      <div className="row">
        <strong className="grow">{ok ? (near ? '👍 Gần đúng!' : '🎉 Chính xác!') : '😅 Chưa đúng'}</strong>
        {speakText && <SpeakButton text={speakText} />}
      </div>
      {answer && <div className="answer">{answer}</div>}
      {children}
    </div>
  )
}
