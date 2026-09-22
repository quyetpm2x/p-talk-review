import { describe, it, expect } from 'vitest'
import { validateLesson } from '../src/lessons/validate'
import lesson from '../src/lessons/level2-01.json'
import lesson2 from '../src/lessons/level2-02.json'
import { lessons } from '../src/lessons'

describe('validateLesson', () => {
  it('bài 1 hợp lệ', () => expect(validateLesson(lesson)).toEqual([]))
  it('bài 2 hợp lệ, có 25 cụm / 5 nhóm, mỗi nhóm 5 cụm', () => {
    expect(validateLesson(lesson2)).toEqual([])
    expect(lesson2.phrases).toHaveLength(25)
    for (const g of lesson2.groups) expect(lesson2.phrases.filter((p) => p.group === g.id), g.id).toHaveLength(5)
    expect(lesson2.dialogues).toHaveLength(2)
    expect(lesson2.missions).toHaveLength(4)
    expect(lesson2.grammar).toHaveLength(3)
  })
  it('các bài có id khác nhau, số bài tăng dần', () => {
    expect(new Set(lessons.map((l) => l.id)).size).toBe(lessons.length)
    expect(lessons.map((l) => l.number)).toEqual([...lessons.map((l) => l.number)].sort((a, b) => a - b))
  })
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
