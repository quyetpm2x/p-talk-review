/**
 * Dữ liệu nhóm “🎬 Nhập vai”: kịch bản Phim tương tác và Nhắn tin.
 * Kịch bản mỗi bài nằm ở src/lessons/stories/<id>.json và src/lessons/chats/<id>.json.
 */
import type { Lesson } from '../../types'
import type { Item } from '../../lib/picker'
import { cleanPhrase, matchRatio } from '../../lib/scoring'
import story_l2_01 from '../../lessons/stories/level2-01.json'
import chats_l2_01 from '../../lessons/chats/level2-01.json'
import { shuffle, type Rnd } from '../../lib/shuffle'

// ================= Kiểu dữ liệu =================

/** good = hợp tình huống, off = sai sắc thái (đúng ngữ pháp nhưng lạc giọng), rude = kém lịch sự */
export type ChoiceKind = 'good' | 'off' | 'rude'
export type Mood = 'idle' | 'talk' | 'happy' | 'meh' | 'awkward'
export type Line = { en: string; vi: string }

export type StoryChoice = Line & {
  kind: ChoiceKind
  /** id cụm toolkit (lesson.phrases / extraPhrases) — bắt buộc với lựa chọn “good” */
  toolkit?: string[]
  /** Giải thích tiếng Việt vì sao tốt / chưa tốt */
  explain: string
  /** Câu bạn cũ đáp lại ngay sau lựa chọn */
  reply?: Line
  /** Nhảy sang lượt khác (phân nhánh); không có thì theo node.next */
  next?: string
  /** Thay đổi độ thân thiết; mặc định theo kind */
  delta?: number
}

export type StoryNode = Line & {
  id: string
  choices: StoryChoice[]
  /** Lượt kế tiếp; không có = hết phim */
  next?: string
}

export type StoryEnding = Line & {
  id: string
  /** Độ thân thiết tối thiểu để mở cái kết này */
  min: number
  icon: string
  title: string
  desc: string
  mood: Mood
}

export type Story = {
  lessonId: string
  title: string
  setting: string
  friend: { name: string; voice: string }
  start: string
  nodes: StoryNode[]
  endings: StoryEnding[]
}

export type ChatOption = Line & { ok: boolean; toolkit?: string[]; why?: string }

export type ChatTurn = {
  id: string
  /** Các tin bạn cũ gửi trước khi tới lượt học sinh */
  friend: Line[]
  options: ChatOption[]
  replyOk: Line[]
  replyBad: Line[]
}

export type Chat = {
  id: string
  lessonId: string
  title: string
  /** Giọng đọc chọn theo tên (NAME_VOICES); `voice` chỉ để ghi đè khi tên chưa có trong bảng */
  friend: { name: string; avatar: string; voice?: string }
  /** Vai của người chơi; không có = “bạn” (giọng PLAYER_VOICE) */
  player?: { name: string; voice?: string }
  /** Lời giới thiệu ở màn mở đầu, **đậm** được hỗ trợ */
  intro?: string
  /** Thời gian trả lời mỗi lượt (giây) */
  seconds: number
  timeout: Line
  turns: ChatTurn[]
  outro: Line[]
}

// ================= Kho kịch bản =================

// Thêm bài mới: import JSON và thêm vào 2 mảng này.
const STORIES: Story[] = [story_l2_01 as unknown as Story]
type ChatFile = { lessonId: string; chats: Omit<Chat, 'lessonId'>[] }
const CHATS: Chat[] = ([chats_l2_01] as unknown as ChatFile[]).flatMap((f) => f.chats.map((c) => ({ ...c, lessonId: f.lessonId })))

export const getStory = (lessonId: string) => STORIES.find((s) => s.lessonId === lessonId)
export const getChats = (lessonId: string) => CHATS.filter((c) => c.lessonId === lessonId)

/** Kịch bản nhắn tin ngẫu nhiên của bài, tránh lặp lại kịch bản `lastId` (lượt trước) nếu còn kịch bản khác. */
export function pickChat(lessonId: string, lastId?: string | null, rnd: Rnd = Math.random): Chat | undefined {
  const all = getChats(lessonId)
  const fresh = all.filter((c) => c.id !== lastId)
  return shuffle(fresh.length ? fresh : all, rnd)[0]
}

const LAST_CHAT_KEY = 'ptalk:v1:chat-last'
export function lastChatId(lessonId: string): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_CHAT_KEY) ?? '{}')?.[lessonId]
    return typeof v === 'string' ? v : null
  } catch {
    return null
  }
}
export function saveLastChat(lessonId: string, chatId: string) {
  try {
    const all = JSON.parse(localStorage.getItem(LAST_CHAT_KEY) ?? '{}')
    localStorage.setItem(LAST_CHAT_KEY, JSON.stringify({ ...(all && typeof all === 'object' ? all : {}), [lessonId]: chatId }))
  } catch {
    /* bỏ qua */
  }
}

export const START_CLOSENESS = 50
export const DELTA: Record<ChoiceKind, number> = { good: 8, off: -8, rude: -16 }
export const choiceDelta = (c: StoryChoice) => c.delta ?? DELTA[c.kind]
export const clamp100 = (n: number) => Math.max(0, Math.min(100, n))

/** Cái kết theo độ thân thiết: cái có min cao nhất mà vẫn ≤ điểm. */
export function endingFor(story: Story, closeness: number): StoryEnding {
  const sorted = [...story.endings].sort((a, b) => b.min - a.min)
  return sorted.find((e) => closeness >= e.min) ?? sorted[sorted.length - 1]
}

// ================= Cụm toolkit =================

/** Tìm cụm (chính hoặc gợi ý thêm) theo id, trả về dạng Item. */
export function findItem(lesson: Lesson, id: string): Item | undefined {
  const p = lesson.phrases.find((x) => x.id === id)
  if (p) return { ...p }
  const x = lesson.extraPhrases.find((e) => e.id === id)
  return x ? { ...x, extra: true } : undefined
}

export const storyLockReason = (lesson: Lesson) => (getStory(lesson.id) ? null : 'Bài này chưa có kịch bản')
export const chatLockReason = (lesson: Lesson) => (getChats(lesson.id).length ? null : 'Bài này chưa có kịch bản')

// ================= Âm thanh =================

/** Bỏ emoji để đọc/tạo giọng (TTS đọc emoji rất kỳ). */
export const sayable = (text: string) =>
  text.replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim()

/** Giọng đọc câu của người chơi (lựa chọn tốt trong phim). */
export const PLAYER_VOICE = 'af_heart'

const MALE = 'am_michael'
const FEMALE = 'af_heart'
/** Giọng Kokoro theo tên nhân vật (nam/nữ). Thêm nhân vật mới vào đây. */
export const NAME_VOICES: Record<string, string> = {
  Tuấn: MALE, Hùng: MALE, Nam: MALE, Minh: MALE,
  Mai: FEMALE, Linh: FEMALE, Lan: FEMALE, Hoa: FEMALE,
}
export const voiceOf = (who: { name: string; voice?: string } | undefined, fallback = PLAYER_VOICE) =>
  who?.voice ?? (who ? NAME_VOICES[who.name] : undefined) ?? fallback
export const friendVoice = (c: Chat) => voiceOf(c.friend, MALE)
export const playerVoice = (c: Chat) => voiceOf(c.player)

/** Mọi câu tiếng Anh có nút nghe / được đọc trong 2 trò của bài — để tạo file Kokoro. */
export function collectStoryClips(lessonId: string): { text: string; voice: string }[] {
  const out = new Map<string, { text: string; voice: string }>()
  const add = (text: string | undefined, voice: string) => {
    const t = text && sayable(text)
    if (t) out.set(`${voice}|${t}`, { text: t, voice })
  }
  const s = getStory(lessonId)
  if (s) {
    const v = s.friend.voice
    for (const n of s.nodes) {
      add(n.en, v)
      for (const c of n.choices) {
        add(c.reply?.en, v)
        if (c.kind === 'good') add(c.en, PLAYER_VOICE)
      }
    }
    for (const e of s.endings) add(e.en, v)
  }
  for (const c of getChats(lessonId)) {
    const v = friendVoice(c)
    const pv = playerVoice(c)
    add(c.timeout.en, v)
    for (const t of c.turns) {
      for (const m of [...t.friend, ...t.replyOk, ...t.replyBad]) add(m.en, v)
      // Tin người chơi gửi (cả gợi ý sai) cũng được đọc lên
      for (const o of t.options) add(o.en, pv)
    }
    for (const m of c.outro) add(m.en, v)
  }
  return [...out.values()]
}

// ================= Kiểm tra dữ liệu =================

/** Câu có chứa cụm toolkit không (bỏ “...” cuối cụm, bỏ dấu câu, mở rộng viết tắt). */
const containsPhrase = (sentence: string, phrase: string) => matchRatio(cleanPhrase(phrase), sentence) >= 0.999

function checkToolkit(errs: string[], where: string, ids: string[] | undefined, text: string, lesson: Lesson) {
  for (const id of ids ?? []) {
    const it = findItem(lesson, id)
    if (!it) errs.push(`${where}: toolkit “${id}” không có trong bài`)
    else if (!containsPhrase(text, it.en)) errs.push(`${where}: câu không chứa cụm toolkit “${it.en}”`)
  }
}

const hasLine = (l: Partial<Line> | undefined) => !!l && typeof l.en === 'string' && !!l.en.trim() && typeof l.vi === 'string' && !!l.vi.trim()

export function validateStory(story: Story, lesson: Lesson): string[] {
  const errs: string[] = []
  if (story.lessonId !== lesson.id) errs.push(`lessonId “${story.lessonId}” khác bài “${lesson.id}”`)
  const ids = new Set<string>()
  for (const n of story.nodes) {
    if (ids.has(n.id)) errs.push(`node “${n.id}” bị trùng id`)
    ids.add(n.id)
  }
  if (!ids.has(story.start)) errs.push(`start “${story.start}” không tồn tại`)

  for (const n of story.nodes) {
    const w = `node ${n.id}`
    if (!hasLine(n)) errs.push(`${w}: thiếu câu en/vi`)
    if (n.choices.length !== 3) errs.push(`${w}: cần đúng 3 lựa chọn`)
    const goods = n.choices.filter((c) => c.kind === 'good')
    if (goods.length !== 1) errs.push(`${w}: cần đúng 1 lựa chọn tốt (đang có ${goods.length})`)
    if (new Set(n.choices.map((c) => c.kind)).size !== n.choices.length) errs.push(`${w}: các lựa chọn phải khác loại (good/off/rude)`)
    if (n.next && !ids.has(n.next)) errs.push(`${w}: next “${n.next}” không tồn tại`)
    n.choices.forEach((c, i) => {
      const cw = `${w} lựa chọn ${i + 1}`
      if (!['good', 'off', 'rude'].includes(c.kind)) errs.push(`${cw}: kind “${c.kind}” không hợp lệ`)
      if (!hasLine(c)) errs.push(`${cw}: thiếu câu en/vi`)
      if (!c.explain?.trim()) errs.push(`${cw}: thiếu giải thích`)
      if (c.reply && !hasLine(c.reply)) errs.push(`${cw}: reply thiếu en/vi`)
      if (c.next && !ids.has(c.next)) errs.push(`${cw}: next “${c.next}” không tồn tại`)
      if (c.kind === 'good' && !c.toolkit?.length) errs.push(`${cw}: lựa chọn tốt phải dùng ít nhất 1 cụm toolkit`)
      checkToolkit(errs, cw, c.toolkit, c.en, lesson)
    })
  }

  // Mọi nhánh phải kết thúc (không vòng lặp) và mọi node đều tới được từ start
  const byId = new Map(story.nodes.map((n) => [n.id, n]))
  const state = new Map<string, 'visiting' | 'done'>()
  const walk = (id: string, path: string[]) => {
    const n = byId.get(id)
    if (!n) return
    if (state.get(id) === 'done') return
    if (state.get(id) === 'visiting') {
      errs.push(`vòng lặp: ${[...path, id].join(' → ')} — nhánh không bao giờ tới cái kết`)
      return
    }
    state.set(id, 'visiting')
    for (const nx of successors(n)) if (nx) walk(nx, [...path, id])
    state.set(id, 'done')
  }
  if (byId.has(story.start)) walk(story.start, [])
  for (const n of story.nodes) if (!state.has(n.id)) errs.push(`node “${n.id}” không tới được từ start`)

  if (!story.endings.length) errs.push('cần ít nhất 1 cái kết')
  if (story.endings.length && !story.endings.some((e) => e.min <= 0)) errs.push('cần một cái kết có min = 0 (để điểm nào cũng có kết)')
  const eids = new Set<string>()
  for (const e of story.endings) {
    if (eids.has(e.id)) errs.push(`ending “${e.id}” bị trùng id`)
    eids.add(e.id)
    if (!e.title?.trim() || !e.icon) errs.push(`ending “${e.id}”: thiếu tiêu đề/biểu tượng`)
    if (!hasLine(e)) errs.push(`ending “${e.id}”: thiếu câu en/vi`)
  }
  return errs
}

/** Các node kế tiếp của một node (undefined = kết thúc ở đây). */
export function successors(n: StoryNode): (string | undefined)[] {
  return [...new Set(n.choices.map((c) => c.next ?? n.next))]
}

/** Liệt kê mọi đường đi từ start tới lúc hết phim (dùng cho test). */
export function allPaths(story: Story, limit = 1000): string[][] {
  const byId = new Map(story.nodes.map((n) => [n.id, n]))
  const out: string[][] = []
  const go = (id: string, path: string[]) => {
    if (out.length >= limit || path.length > story.nodes.length) return
    const n = byId.get(id)
    if (!n) return
    const p = [...path, id]
    for (const nx of successors(n)) (nx ? go(nx, p) : out.push(p))
  }
  go(story.start, [])
  return out
}

export function validateChat(chat: Chat, lesson: Lesson): string[] {
  const errs: string[] = []
  if (chat.lessonId !== lesson.id) errs.push(`lessonId “${chat.lessonId}” khác bài “${lesson.id}”`)
  if (!chat.id?.trim()) errs.push('thiếu id kịch bản')
  for (const who of [chat.friend, chat.player]) {
    if (who && !who.voice && !NAME_VOICES[who.name]) errs.push(`chưa biết giọng nam/nữ của “${who.name}” — thêm vào NAME_VOICES`)
  }
  if (!(chat.seconds >= 5)) errs.push('seconds phải ≥ 5')
  if (!hasLine(chat.timeout)) errs.push('timeout thiếu en/vi')
  if (!chat.turns.length) errs.push('cần ít nhất 1 lượt')
  const ids = new Set<string>()
  for (const t of chat.turns) {
    const w = `lượt ${t.id}`
    if (ids.has(t.id)) errs.push(`${w}: trùng id`)
    ids.add(t.id)
    if (!t.friend.length || !t.friend.every(hasLine)) errs.push(`${w}: tin của bạn cũ thiếu en/vi`)
    if (t.options.length !== 3) errs.push(`${w}: cần đúng 3 gợi ý`)
    const oks = t.options.filter((o) => o.ok)
    if (oks.length !== 1) errs.push(`${w}: cần đúng 1 gợi ý đúng (đang có ${oks.length})`)
    t.options.forEach((o, i) => {
      if (!hasLine(o)) errs.push(`${w} gợi ý ${i + 1}: thiếu en/vi`)
      if (o.ok && !o.toolkit?.length) errs.push(`${w} gợi ý ${i + 1}: gợi ý đúng phải dùng cụm toolkit`)
      if (!o.ok && !o.why?.trim()) errs.push(`${w} gợi ý ${i + 1}: thiếu lý do sai`)
      checkToolkit(errs, `${w} gợi ý ${i + 1}`, o.toolkit, o.en, lesson)
    })
    if (!t.replyOk.length || !t.replyOk.every(hasLine)) errs.push(`${w}: replyOk thiếu`)
    if (!t.replyBad.length || !t.replyBad.every(hasLine)) errs.push(`${w}: replyBad thiếu`)
  }
  if (!chat.outro.every(hasLine)) errs.push('outro thiếu en/vi')
  return errs
}

// ================= Cái kết đã mở khoá (localStorage) =================

const ENDINGS_KEY = 'ptalk:v1:story-endings'

function readEndings(): Record<string, string[]> {
  try {
    const v = JSON.parse(localStorage.getItem(ENDINGS_KEY) ?? '{}')
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch {
    return {}
  }
}

export const unlockedEndings = (lessonId: string): string[] => {
  const v = readEndings()[lessonId]
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
}

/** Lưu cái kết vừa mở; trả về danh sách đã mở (kể cả khi không lưu được). */
export function unlockEnding(lessonId: string, endingId: string): string[] {
  const all = readEndings()
  const list = [...new Set([...unlockedEndings(lessonId), endingId])]
  try {
    localStorage.setItem(ENDINGS_KEY, JSON.stringify({ ...all, [lessonId]: list }))
  } catch { /* không lưu được (chế độ riêng tư…) */ }
  return list
}
