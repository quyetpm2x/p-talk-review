import { SpeakButton } from '../../components/SpeakButton'
import { sayable, type Chat, type ChatOption, type Line } from './data'

/** Diễn biến một lượt: bạn cũ nhắn gì, bạn trả lời gì, mất bao lâu. */
export type TurnLog = {
  friend: Line[]
  /** null = hết giờ, không trả lời */
  reply: ChatOption | null
  good: ChatOption
  ok: boolean
  voice: boolean
  /** Số giây đã dùng để trả lời */
  secs: number
}

const fmt = (s: number) => `${Math.round(s * 10) / 10}s`.replace('.', ',')

/** Thống kê cuộc trò chuyện — hiện trong trang kết quả của trò Nhắn tin. */
export function ChatSummary({ chat, log, friendVoice, playerVoice, userName }: {
  chat: Chat; log: TurnLog[]; friendVoice: string; playerVoice: string; userName?: string
}) {
  const me = userName || 'bạn'
  const answered = log.filter((t) => t.reply)
  const ok = log.filter((t) => t.ok).length
  const voice = log.filter((t) => t.voice).length
  const timeouts = log.length - answered.length
  const avg = answered.length ? answered.reduce((a, t) => a + t.secs, 0) / answered.length : 0
  const fastest = answered.filter((t) => t.ok).sort((a, b) => a.secs - b.secs)[0]
  const pct = log.length ? Math.round((ok / log.length) * 100) : 0
  const verdict =
    pct === 100 ? `Xuất sắc, ${me}! ${chat.friend.name} rất vui khi nói chuyện với bạn 🥰`
    : pct >= 70 ? `Làm tốt lắm, ${me}! ${chat.friend.name} muốn gặp lại bạn 😊`
    : pct >= 40 ? `${me} ơi, có vài chỗ hơi ngượng — xem lại các lượt sai bên dưới nhé`
    : `${chat.friend.name} hơi hụt hẫng 😅 — ${me} thử lại và chọn câu thân thiện hơn nhé`

  return (
    <section className="card chat-sum">
      <div className="row chat-sum-head">
        <span className="chat-avatar" aria-hidden>{chat.friend.avatar}</span>
        <div className="grow">
          <div className="label">💬 {chat.title}</div>
          <div className="small muted">
            Nhắn với <b>{chat.friend.name}</b>{chat.player ? <> · bạn vào vai <b>{chat.player.name}</b></> : null}
          </div>
        </div>
      </div>
      <p className="chat-sum-verdict">{verdict}</p>

      <div className="chat-sum-stats">
        <div><b className="ok">{ok}/{log.length}</b><span>tin trả lời hợp</span></div>
        <div><b>{fmt(avg)}</b><span>trả lời trung bình</span></div>
        <div><b>{voice}</b><span>lần nói bằng 🎤</span></div>
        <div><b className={timeouts ? 'bad' : ''}>{timeouts}</b><span>lần hết giờ</span></div>
      </div>
      {fastest && <div className="small muted chat-sum-fast">⚡ Nhanh nhất: {fmt(fastest.secs)} — “{fastest.reply!.en}”</div>}

      <div className="label chat-sum-title">Xem lại cuộc trò chuyện</div>
      <ol className="chat-sum-list">
        {log.map((t, i) => (
          <li key={i} className={t.ok ? 'ok' : 'bad'}>
            <div className="chat-sum-turn">Lượt {i + 1}<span>⏱ {t.reply ? fmt(t.secs) : 'hết giờ'}</span></div>
            {t.friend.map((l, k) => (
              <div key={k} className="msg-row left">
                <span className="msg-ava" aria-hidden style={k ? { visibility: 'hidden' } : undefined}>{chat.friend.avatar}</span>
                <div className="msg friend"><div className="msg-en">{l.en}</div></div>
                <SpeakButton text={sayable(l.en)} size="sm" kokoro={friendVoice} voice="A" />
              </div>
            ))}
            <div className="msg-row right">
              <span className={`msg-mark ${t.ok ? 'ok' : 'bad'}`} aria-label={t.ok ? 'Hợp tình huống' : 'Chưa hợp'}>{t.ok ? '✓' : '✕'}</span>
              <div className={`msg me ${t.ok ? 'ok' : 'bad'}`}>
                <div className="msg-en">
                  {t.voice && <span aria-label="đã nói">🎤 </span>}
                  {t.reply ? t.reply.en : <i>(không trả lời)</i>}
                </div>
              </div>
            </div>
            {!t.ok && (
              <div className="chat-sum-fix">
                {t.reply?.why && <div className="small">💡 {t.reply.why}</div>}
                <div className="row">
                  <div className="grow">
                    <div className="small muted">Nên trả lời</div>
                    <b>{t.good.en}</b>
                    <div className="small muted">{t.good.vi}</div>
                  </div>
                  <SpeakButton text={sayable(t.good.en)} size="sm" kokoro={playerVoice} />
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
