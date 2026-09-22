import { describe, it, expect, beforeEach } from 'vitest'
import lessonJson from '../src/lessons/level2-01.json'
import type { Lesson } from '../src/types'
import { lessons } from '../src/lessons'
import {
  allPaths, clamp100, collectStoryClips, endingFor, getChats, getStories, getStory, pickChat, pickStory, genderOf, friendVoice, playerVoice, sayable, storyLockReason, chatLockReason,
  unlockEnding, unlockedEndings, validateChat, validateStory, START_CLOSENESS, choiceDelta, findItem,
} from '../src/games/story/data'

const lesson = lessonJson as unknown as Lesson
const stories = getStories('level2-01')
const story = stories[0]
const chats = getChats('level2-01')
const chat = chats[0]
const clone = <T,>(x: T) => structuredClone(x) as T

describe('Phim tương tác — kịch bản Bài 1', () => {
  it('bài nào cũng có ít nhất 3 phim và 3 cuộc nhắn tin, id không trùng trong bài', () => {
    for (const L of lessons) {
      expect(getStories(L.id).length, L.id).toBeGreaterThanOrEqual(3)
      expect(getChats(L.id).length, L.id).toBeGreaterThanOrEqual(3)
      expect(new Set(getStories(L.id).map((x) => x.id)).size).toBe(getStories(L.id).length)
      expect(new Set(getChats(L.id).map((x) => x.id)).size).toBe(getChats(L.id).length)
    }
  })

  it('có nhiều phim, id không trùng, có cả bạn nam và nữ', () => {
    expect(stories.length).toBeGreaterThanOrEqual(3)
    expect(new Set(stories.map((x) => x.id)).size).toBe(stories.length)
    expect(new Set(stories.map((x) => genderOf(x.friend)))).toEqual(new Set(['m', 'f']))
  })

  it('pickStory: ngẫu nhiên và không lặp lại phim vừa xem', () => {
    for (const x of stories) for (let i = 0; i < 20; i++) expect(pickStory('level2-01', x.id)!.id).not.toBe(x.id)
    expect(new Set(Array.from({ length: 60 }, () => pickStory('level2-01', null)!.id)).size).toBe(stories.length)
  })

  it('giọng theo tên: Mai nữ, Tuấn/Nam nam; vai Linh đọc giọng nữ', () => {
    const by = (id: string) => stories.find((x) => x.id === id)!
    expect(friendVoice(by('mai-cafe'))).toBe('af_heart')
    expect(friendVoice(by('tuan-street'))).toBe('am_michael')
    expect(playerVoice(by('tuan-street'))).toBe('af_heart')
    expect(friendVoice(by('nam-wedding'))).toBe('am_michael')
  })

  for (const L of lessons) for (const s of getStories(L.id)) {
    it(`${L.id}/${s.id}: dữ liệu hợp lệ`, () => expect(validateStory(s, L)).toEqual([]))

    it(`${L.id}/${s.id}: có ít nhất 6 lượt và 3 cái kết`, () => {
      expect(s.nodes.length).toBeGreaterThanOrEqual(6)
      expect(s.endings.length).toBeGreaterThanOrEqual(3)
      expect(Math.min(...allPaths(s).map((p) => p.length))).toBeGreaterThanOrEqual(6)
    })

    it(`${L.id}/${s.id}: mỗi lượt có đúng 1 lựa chọn tốt, 1 sai sắc thái, 1 kém lịch sự`, () => {
      for (const n of s.nodes) expect(n.choices.map((c) => c.kind).sort()).toEqual(['good', 'off', 'rude'])
    })

    it(`${L.id}/${s.id}: mọi id cụm toolkit tham chiếu đều có trong bài`, () => {
      const ids = s.nodes.flatMap((n) => n.choices.flatMap((c) => c.toolkit ?? []))
      expect(ids.length).toBeGreaterThan(8)
      for (const id of ids) expect(findItem(L, id), id).toBeDefined()
    })

    it(`${L.id}/${s.id}: dùng cụm của đủ 5 nhóm`, () => {
      const groups = new Set(s.nodes.flatMap((n) => n.choices.flatMap((c) => c.toolkit ?? [])).map((id) => findItem(L, id)?.group))
      for (const g of L.groups) expect(groups.has(g.id), g.id).toBe(true)
    })

    it(`${L.id}/${s.id}: mọi nhánh đều tới được một cái kết`, () => {
      const paths = allPaths(s)
      expect(paths.length).toBeGreaterThan(1) // có phân nhánh
      const byId = new Map(s.nodes.map((n) => [n.id, n]))
      // Duyệt mọi tổ hợp lựa chọn: độ thân thiết nào cũng có cái kết
      const explore = (id: string | undefined, c: number, depth: number): void => {
        expect(depth).toBeLessThanOrEqual(s.nodes.length)
        if (!id) {
          expect(endingFor(s, c)).toBeDefined()
          return
        }
        const n = byId.get(id)!
        for (const ch of n.choices) explore(ch.next ?? n.next, clamp100(c + choiceDelta(ch)), depth + 1)
      }
      explore(s.start, START_CLOSENESS, 0)
    })

    it(`${L.id}/${s.id}: chơi toàn câu tốt → kết tốt nhất, toàn câu kém → kết gượng`, () => {
      const run = (kind: 'good' | 'rude') => {
        let id: string | undefined = s.start
        let c = START_CLOSENESS
        while (id) {
          const n = s.nodes.find((x) => x.id === id)!
          const ch = n.choices.find((x) => x.kind === kind)!
          c = clamp100(c + choiceDelta(ch))
          id = ch.next ?? n.next
        }
        return endingFor(s, c).id
      }
      const top = [...s.endings].sort((a, b) => b.min - a.min)
      expect(run('good')).toBe(top[0].id)
      expect(run('rude')).toBe(top[top.length - 1].id)
    })
  }

  it('báo lỗi khi có 2 lựa chọn tốt', () => {
    const bad = clone(story)
    bad.nodes[0].choices[1].kind = 'good'
    expect(validateStory(bad, lesson).join()).toMatch(/đúng 1 lựa chọn tốt/)
  })

  it('báo lỗi toolkit không tồn tại', () => {
    const bad = clone(story)
    bad.nodes[0].choices[0].toolkit = ['zz9']
    expect(validateStory(bad, lesson).join()).toMatch(/zz9/)
  })

  it('báo lỗi câu không chứa cụm toolkit', () => {
    const bad = clone(story)
    bad.nodes[0].choices[0].toolkit = ['w4']
    expect(validateStory(bad, lesson).join()).toMatch(/không chứa cụm/)
  })

  it('báo lỗi vòng lặp (nhánh không bao giờ kết thúc)', () => {
    const bad = clone(story)
    const last = bad.nodes[bad.nodes.length - 1]
    last.next = bad.start
    expect(validateStory(bad, lesson).join()).toMatch(/vòng lặp/)
  })

  it('báo lỗi next trỏ tới lượt không tồn tại', () => {
    const bad = clone(story)
    bad.nodes[0].choices[2].next = 'nope'
    expect(validateStory(bad, lesson).join()).toMatch(/nope/)
  })
})

describe('Nhắn tin — kịch bản Bài 1', () => {
  it('có nhiều kịch bản, id không trùng', () => {
    expect(chats.length).toBeGreaterThanOrEqual(3)
    expect(new Set(chats.map((c) => c.id)).size).toBe(chats.length)
  })

  for (const L of lessons) for (const c of getChats(L.id)) {
    it(`${L.id}/${c.id}: dữ liệu hợp lệ`, () => expect(validateChat(c, L)).toEqual([]))
    it(`${L.id}/${c.id}: ít nhất 6 lượt, mỗi lượt đúng 1 gợi ý đúng`, () => {
      expect(c.turns.length).toBeGreaterThanOrEqual(6)
      for (const t of c.turns) expect(t.options.filter((o) => o.ok)).toHaveLength(1)
    })
  }

  it('giọng đọc theo tên nhân vật: nam → am_michael, nữ → af_heart', () => {
    const by = (id: string) => chats.find((c) => c.id === id)!
    expect(friendVoice(by('tuan-classmate'))).toBe('am_michael')
    expect(friendVoice(by('mai-cafe'))).toBe('af_heart')
    expect(playerVoice(by('mai-cafe'))).toBe('am_michael') // Hùng
    expect(friendVoice(by('linh-street'))).toBe('af_heart')
    expect(playerVoice(by('linh-street'))).toBe('am_michael') // Tuấn
  })

  it('báo lỗi khi tên nhân vật chưa biết giọng nam/nữ', () => {
    const bad = { ...clone(chat), friend: { name: 'Zed', avatar: '🙂' } }
    expect(validateChat(bad, lesson).join()).toMatch(/Zed/)
  })

  it('pickChat: ngẫu nhiên và không lặp lại kịch bản vừa chơi', () => {
    for (const c of chats) for (let i = 0; i < 20; i++) expect(pickChat('level2-01', c.id)!.id).not.toBe(c.id)
    const seen = new Set(Array.from({ length: 60 }, () => pickChat('level2-01', null)!.id))
    expect(seen.size).toBe(chats.length)
    expect(pickChat('nope')).toBeUndefined()
  })

  it('báo lỗi khi không có gợi ý đúng', () => {
    const bad = clone(chat)
    bad.turns[0].options[0].ok = false
    expect(validateChat(bad, lesson).join()).toMatch(/đúng 1 gợi ý đúng/)
  })
})

describe('Tiện ích', () => {
  beforeEach(() => localStorage.clear())

  it('tra được kịch bản theo bài', () => {
    expect(getStory('level2-01')).toBeDefined()
    expect(getChats('level2-01').length).toBeGreaterThan(0)
    expect(getStory('nope')).toBeUndefined()
  })

  it('collectStoryClips: có câu của cả 2 trò, không emoji, đúng giọng', () => {
    const clips = collectStoryClips('level2-01')
    const texts = clips.map((c) => c.text)
    expect(texts).toContain(sayable(story.nodes[0].en))
    for (const c of chats) expect(texts).toContain(sayable(c.timeout.en))
    expect(clips.some((c) => c.voice === 'af_heart')).toBe(true)
    expect(clips.some((c) => c.voice === 'am_michael')).toBe(true)
    for (const c of clips) expect(c.text).not.toMatch(/\p{Extended_Pictographic}/u)
    expect(new Set(clips.map((c) => `${c.voice}|${c.text}`)).size).toBe(clips.length)
    expect(collectStoryClips('nope')).toEqual([])
  })

  it('lockReason: mở khi bài có kịch bản, khoá khi không', () => {
    expect(storyLockReason(lesson)).toBeNull()
    expect(chatLockReason(lesson)).toBeNull()
    const fake = { ...lesson, id: 'no-story' }
    expect(storyLockReason(fake)).toBe('Bài này chưa có kịch bản')
    expect(chatLockReason(fake)).toBe('Bài này chưa có kịch bản')
  })

  it('lưu cái kết đã mở khoá theo từng phim', () => {
    expect(unlockedEndings('level2-01', 'mai-cafe')).toEqual([])
    unlockEnding('level2-01', 'mai-cafe', 'bye')
    unlockEnding('level2-01', 'mai-cafe', 'bye')
    unlockEnding('level2-01', 'mai-cafe', 'coffee')
    expect(unlockedEndings('level2-01', 'mai-cafe')).toEqual(['bye', 'coffee'])
    expect(unlockedEndings('level2-01', 'tuan-street')).toEqual([])
    localStorage.setItem('ptalk:v1:story-endings', '{hỏng')
    expect(unlockedEndings('level2-01', 'mai-cafe')).toEqual([])
  })

  it('cái kết đã mở ở bản cũ (lưu theo bài) vẫn còn ở phim đầu tiên', () => {
    localStorage.setItem('ptalk:v1:story-endings', JSON.stringify({ 'level2-01': ['zalo'] }))
    expect(unlockedEndings('level2-01', 'mai-cafe')).toEqual(['zalo'])
    expect(unlockedEndings('level2-01', 'tuan-street')).toEqual([])
    expect(unlockEnding('level2-01', 'mai-cafe', 'coffee')).toEqual(['zalo', 'coffee'])
  })
})
