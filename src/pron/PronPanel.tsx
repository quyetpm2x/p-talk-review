import { useEffect, useRef } from 'react'
import { speak } from '../lib/speech'
import { errorText, sentenceLevel, type WordResult } from './core'
import '../talk/talk.css'
import { deleteModel, refreshDownload, startDownload, usePronDownload } from './model'
import { loadEngine, unloadEngine } from './engine'

const LEVEL_CLASS = { 'Tốt': 'ok', 'Khá': 'mid', 'Cần luyện': 'bad' } as const

/** Chip dưới câu học sinh nói: "Phát âm: Khá". */
export function PronChip({ status, words, onOpen }: { status: 'pending' | 'done' | 'error'; words?: WordResult[]; onOpen: () => void }) {
  if (status === 'pending') return <span className="pron-chip pending">Đang chấm phát âm…</span>
  if (status === 'error' || !words) return <span className="pron-chip err">Chưa chấm được phát âm</span>
  const lv = sentenceLevel(words)
  return <button className={`pron-chip ${LEVEL_CLASS[lv]}`} onClick={onOpen}>Phát âm: <b>{lv}</b> ›</button>
}

/** Bảng chi tiết: từ tô màu, danh sách lỗi âm, nghe giọng Cú / giọng mình. */
export function PronSheet({ text, words, wavUrl, rate, onClose }: { text: string; words: WordResult[]; wavUrl?: string; rate: number; onClose: () => void }) {
  const errs = words.flatMap((w) => w.errors.map((e) => ({ w, e })))
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet pron-sheet" role="dialog" aria-modal="true" aria-label="Chấm phát âm" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden />
        <div className="row"><div className="sheet-title grow">🎯 Chấm phát âm</div><button className="btn btn-ghost btn-sm" onClick={onClose}>Đóng</button></div>
        <p className="pron-words">{words.map((w, i) => (
          <span key={i} className={`pw ${LEVEL_CLASS[w.level]} ${w.known ? '' : 'unknown'}`} title={w.known ? w.phones.join(' ') : 'Từ này chưa có trong từ điển chấm âm'}>{w.word}</span>
        ))}</p>
        <div className="row">
          <button className="btn btn-ghost grow" onClick={() => speak(text, { rate })}>🦉 Cú đọc</button>
          {wavUrl && <button className="btn btn-ghost grow" onClick={() => void new Audio(wavUrl).play()}>🎧 Giọng bạn</button>}
        </div>
        {errs.length ? (
          <ul className="pron-errs">{errs.map(({ w, e }, i) => (
            <li key={i}><b>{errorText(w.word, e)}</b><button onClick={() => speak(w.word, { rate: Math.min(rate, 0.8) })} aria-label={`Nghe ${w.word}`}>🔊</button></li>
          ))}</ul>
        ) : (
          <p className="pron-good">{sentenceLevel(words) === 'Tốt' ? '👏 Không thấy lỗi âm nào — tốt lắm!' : 'Gần đúng rồi — nghe Cú đọc rồi thử nói chậm và rõ hơn nhé.'}</p>
        )}
        <p className="pron-note">Cú kiểm các lỗi hay gặp của người Việt (th, sh, v, âm cuối…). Chữ xám là từ Cú chưa chấm được.</p>
      </div>
    </div>
  )
}

/** Mục bật/tắt + tải mô hình chấm phát âm (trong ⚙️ của phòng nói chuyện). Tiến độ lấy từ kho dùng chung → tải tiếp dù rời màn hình. */
export function PronSetting({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  const dl = usePronDownload()
  useEffect(() => { if (dl.status === 'unknown') void refreshDownload() }, [dl.status])
  // tải xong (kể cả khi đang ở màn khác) → tự bật chấm phát âm và nạp sẵn mô hình
  const was = useRef(dl.status)
  useEffect(() => {
    if (was.current === 'downloading' && dl.status === 'ready') { onChange(true); void loadEngine().catch(() => {}) }
    was.current = dl.status
  }, [dl.status, onChange])
  const ready = dl.status === 'ready'
  return (
    <div className="pron-setting">
      <div className="row">
        <div className="grow"><b>🎯 Chấm phát âm</b></div>
        {ready && <button role="switch" aria-checked={enabled} className={`switch ${enabled ? 'on' : ''}`} onClick={() => onChange(!enabled)}><i /></button>}
      </div>
      {dl.status === 'missing' && (
        <button className="btn btn-primary btn-block" onClick={() => void startDownload()}>Tải bộ chấm</button>
      )}
      {dl.status === 'downloading' && (
        <>
          <div className="pron-prog"><i style={{ width: `${Math.round(dl.progress * 100)}%` }} /><small>Đang tải {Math.round(dl.progress * 100)}%…</small></div>
          <small className="pron-hint">Bạn có thể tắt màn hình hoặc dùng app khác — bộ chấm vẫn tiếp tục tải.</small>
        </>
      )}
      {dl.status === 'error' && (
        <>
          <small className="pron-err">{dl.error}</small>
          <button className="btn btn-primary btn-block" onClick={() => void startDownload()}>Tải tiếp</button>
        </>
      )}
      {ready && <button className="btn btn-ghost btn-sm" onClick={async () => { unloadEngine(); await deleteModel(); onChange(false) }}>Xoá bộ chấm khỏi máy</button>}
    </div>
  )
}

/** Thanh nhỏ báo đang tải bộ chấm — hiện ở mọi màn hình trong lúc tải. */
export function PronDownloadBadge() {
  const dl = usePronDownload()
  if (dl.status !== 'downloading') return null
  return <div className="pron-badge" role="status">🎯 Đang tải bộ chấm phát âm {Math.round(dl.progress * 100)}%</div>
}
