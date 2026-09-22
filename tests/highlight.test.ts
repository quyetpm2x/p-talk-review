import { it, expect } from 'vitest'
import { splitToolkit } from '../src/components/Highlight'

it('tách câu theo cụm toolkit, giữ thứ tự xuất hiện', () => {
  const s = splitToolkit('Linh! What are the odds! It\'s been ages — how have you been?', ["It's been ages", 'What are the odds!', 'how have you been?'])
  expect(s.map((x) => x.t).join('')).toBe("Linh! What are the odds! It's been ages — how have you been?")
  expect(s.filter((x) => x.k !== undefined).map((x) => x.k)).toEqual([1, 0, 2])
})
it('không có toolkit', () => expect(splitToolkit('Hi', [])).toEqual([{ t: 'Hi' }]))
