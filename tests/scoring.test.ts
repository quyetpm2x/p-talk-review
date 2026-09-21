import { it, expect } from 'vitest'
import { matchRatio, matchedWords, fuzzyEqual, normalize, blankOf, cleanPhrase } from '../src/lib/scoring'

it('normalize', () => expect(normalize("It's been ages!")).toEqual(['it', 'is', 'been', 'ages']))
it('normalize dấu nháy cong', () => expect(normalize('I’ve got it')).toEqual(['i', 'have', 'got', 'it']))
it('khớp hoàn toàn', () => expect(matchRatio("It's been ages!", 'it is been ages')).toBe(1))
it('khớp dù nói dạng rút gọn', () => expect(matchRatio('It is been ages', "it's been ages")).toBe(1))
it('thiếu từ', () => expect(matchRatio('How have you been?', 'how you been')).toBeCloseTo(0.75))
it('rỗng', () => expect(matchRatio('Hi there', '')).toBe(0))
it('matchedWords theo token hiển thị', () =>
  expect(matchedWords('How have you been?', 'how you been')).toEqual([true, false, true, true]))
it('fuzzy', () => {
  expect(fuzzyEqual('ages', 'Ages ')).toBe('exact')
  expect(fuzzyEqual('ages', 'agez')).toBe('near')
  expect(fuzzyEqual('ages', 'years')).toBe('wrong')
  expect(fuzzyEqual("'ve", '’ve')).toBe('exact')
  expect(fuzzyEqual('used to', 'used  to')).toBe('exact')
})
it('blankOf mặc định từ dài nhất', () => expect(blankOf({ en: 'Long time no see!' })).toBe('Long'))
it('blankOf dùng blank', () => expect(blankOf({ en: "It's been ages!", blank: 'ages' })).toBe('ages'))
it('cleanPhrase bỏ dấu ... ở cuối', () => {
  expect(cleanPhrase('Believe it or not, ...')).toBe('Believe it or not')
  expect(cleanPhrase('You’ll never guess what — ...')).toBe('You’ll never guess what')
  expect(cleanPhrase('Do you remember that time when ...?')).toBe('Do you remember that time when ...?')
})
