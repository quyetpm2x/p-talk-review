import { describe, it, expect } from 'vitest'
import { cleanName, nameError, NAME_MAX } from '../src/lib/name'
import { emptyProgress, normalizeProgress, setName } from '../src/lib/progress'

describe('Tên người dùng', () => {
  it('cleanName: bỏ khoảng trắng thừa, ký tự điều khiển, cắt độ dài', () => {
    expect(cleanName('  Quyết   Nguyễn ')).toBe('Quyết Nguyễn')
    expect(cleanName('Mai\n\tAnh')).toBe('Mai Anh')
    expect(cleanName('<b>Linh</b>')).toBe('b Linh /b')
    expect(cleanName('a'.repeat(40))).toHaveLength(NAME_MAX)
  })

  it('nameError: tên trống hoặc không có chữ thì báo lỗi', () => {
    expect(nameError('')).toMatch(/Nhập tên/)
    expect(nameError('   ')).toMatch(/Nhập tên/)
    expect(nameError('!!!')).toMatch(/chữ cái/)
    expect(nameError('Quyết')).toBeNull()
    expect(nameError('Bé Na 2')).toBeNull()
  })

  it('lưu tên vào tiến độ; bản cũ chưa có tên → tên rỗng', () => {
    expect(emptyProgress().name).toBe('')
    expect(normalizeProgress({ xp: 5 }).name).toBe('')
    expect(normalizeProgress({ name: 42 }).name).toBe('')
    expect(normalizeProgress({ name: '  Hùng ' }).name).toBe('Hùng')
    const p = setName(emptyProgress(), '  Lan  ')
    expect(p.name).toBe('Lan')
  })
})
