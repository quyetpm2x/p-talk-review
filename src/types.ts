export type Group = { id: string; en: string; vi: string; icon: string; order: number }

export type Phrase = {
  id: string
  group: string
  en: string
  vi: string
  /** Cụm đồng nghĩa */
  synonym?: string
  /** Độ bất ngờ 1 (nhẹ) → 3 (mạnh) */
  intensity?: number
  /** Từ khoá bị ẩn ở trò Điền từ */
  blank?: string
  /** Tình huống tiếng Việt cho trò Hợp tình huống */
  situation?: string
  /** Ghi chú sắc thái */
  note?: string
}

export type ExtraPhrase = { id: string; en: string; vi: string; source?: string; blank?: string }

export type DialogueLine = { speaker: 'A' | 'B'; text: string; toolkit: string[] }

export type Dialogue = {
  title: string
  setting: string
  /** Giọng Kokoro cho từng vai, ví dụ { "A": "am_michael", "B": "af_heart" } */
  voices?: { A?: string; B?: string }
  lines: DialogueLine[]
  newWords: { en: string; meaning: string; vi: string }[]
}

export type Mission = {
  title: string
  level: string
  situation: string
  kickoff: string
  goals: string[]
  hints: { en: string; vi: string }[]
}

export type Exercise =
  | { type: 'choice'; q: string; options: string[]; answer: number; explain: string }
  | { type: 'input'; q: string; answers: string[]; explain: string }

export type GrammarPoint = { title: string; notes: string[]; exercises: Exercise[] }

export type Lesson = {
  id: string
  level: number
  number: number
  title: string
  titleVi: string
  objectives: string[]
  groups: Group[]
  phrases: Phrase[]
  extraPhrases: ExtraPhrase[]
  dialogues: Dialogue[]
  missions: Mission[]
  grammar: GrammarPoint[]
}
