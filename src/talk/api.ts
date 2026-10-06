import { API_URL, ApiError } from '../lib/api'
import { parseSse, type TalkMeta } from './core'

export type TurnBody = {
  mode: 'lesson' | 'free'
  lesson: { title: string; titleVi: string; phrases: string[] }
  topic?: string
  history: { role: 'tutor' | 'student'; text: string }[]
  text: string
}

/** Một lượt nói: gọi onDelta với từng đoạn lời gia sư (đọc ngay), trả về dữ liệu phụ khi xong. */
export async function talkTurn(token: string, body: TurnBody, onDelta: (t: string) => void, signal?: AbortSignal): Promise<TalkMeta> {
  if (!API_URL) throw new ApiError(0, 'Ứng dụng chưa được cấu hình máy chủ')
  let res: Response
  try {
    res = await fetch(`${API_URL}/talk/turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (e) {
    if (signal?.aborted) throw e
    throw new ApiError(0, 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại nhé')
  }
  if (!res.ok || !res.body) {
    const j = await res.json().catch(() => ({}))
    throw new ApiError(res.status, j?.error ?? 'Cú chưa nghe rõ, thử lại nhé')
  }
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let meta: TalkMeta | null = null
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    const parsed = parseSse(buf + dec.decode(value, { stream: true }))
    buf = parsed.rest
    for (const e of parsed.events) {
      if (e.event === 'delta' && e.data?.t) onDelta(e.data.t)
      else if (e.event === 'meta') meta = e.data
      else if (e.event === 'error') throw new ApiError(502, e.data?.error ?? 'Cú chưa nghe rõ, thử lại nhé')
    }
  }
  return meta ?? { reply: '', reply_vi: '', fix: null, new_words: [] }
}

export type TalkSummary = { phrases_used: string[]; fixes: { said: string; better: string }[]; tip_vi: string }

export async function talkSummary(token: string, body: { lesson: TurnBody['lesson']; transcript: { role: string; text: string }[] }): Promise<TalkSummary> {
  const res = await fetch(`${API_URL}/talk/summary`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  }).catch(() => null)
  if (!res?.ok) return { phrases_used: [], fixes: [], tip_vi: '' }
  return res.json()
}
