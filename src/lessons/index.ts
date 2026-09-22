import type { Lesson } from '../types'
import { validateLesson } from './validate'
import l2_01 from './level2-01.json'
import l2_02 from './level2-02.json'

// Thêm bài mới: import file JSON và thêm vào mảng này.
const raw: unknown[] = [l2_01, l2_02]

export const lessons: Lesson[] = raw.map((l) => {
  const errs = validateLesson(l)
  if (errs.length) console.error(`Bài học lỗi (${(l as Lesson).id}):`, errs)
  return l as Lesson
})

export const getLesson = (id: string) => lessons.find((l) => l.id === id)
