import { describe, it, expect } from 'vitest'
import { validateLesson } from '../src/lessons/validate'
import lesson from '../src/lessons/level2-01.json'

describe('validateLesson', () => {
  it('bài 1 hợp lệ', () => expect(validateLesson(lesson)).toEqual([]))
  it('báo lỗi toolkit không nằm trong câu', () => {
    const bad = structuredClone(lesson) as any
    bad.dialogues[0].lines[0].toolkit = ['xyz not here']
    expect(validateLesson(bad).join()).toMatch(/toolkit/)
  })
  it('báo lỗi phrase trỏ tới group không tồn tại', () => {
    const bad = structuredClone(lesson) as any
    bad.phrases[0].group = 'nope'
    expect(validateLesson(bad).join()).toMatch(/group/)
  })
  it('báo lỗi blank không nằm trong cụm', () => {
    const bad = structuredClone(lesson) as any
    bad.phrases[0].blank = 'zzz'
    expect(validateLesson(bad).join()).toMatch(/blank/)
  })
  it('bài 1 có 25 cụm, 5 nhóm', () => {
    expect(lesson.phrases).toHaveLength(25)
    expect(lesson.groups).toHaveLength(5)
  })
})
