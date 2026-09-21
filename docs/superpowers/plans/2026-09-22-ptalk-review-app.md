# PTALK Review App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web PWA mobile-first để học sinh PTALK ôn Kho cụm từ (14 trò), Role-play (nghe / điền / đóng vai / thẻ nhiệm vụ có ghi âm) và Ngữ pháp sau mỗi buổi học.

**Architecture:** SPA tĩnh React + TS (Vite), HashRouter. Nội dung mỗi bài là 1 file JSON đã validate. Logic thuần (Leitner, chọn câu, chấm điểm, tiến độ) nằm trong `src/lib` và được test bằng Vitest; UI chỉ gọi các hàm đó. Mỗi trò là 1 component render *một câu hỏi*, `GameShell` lo vòng 10 câu, điểm và màn kết quả.

**Tech Stack:** React 18, TypeScript 5, Vite 5, react-router-dom 6, vite-plugin-pwa, Vitest + @testing-library/react + jsdom.

**Spec:** `docs/superpowers/specs/2026-09-22-ptalk-review-app-design.md`

## Global Constraints

- Mobile-first, vùng chạm ≥ 44px, max-width 480px, không scroll ngang ở 360px.
- Tông đen/trắng + màu nhấn vàng; dark mode theo `prefers-color-scheme`; tôn trọng `prefers-reduced-motion`.
- Mọi truy cập `localStorage` bọc try/catch; lỗi → app vẫn chạy, không lưu.
- Key lưu trữ: `ptalk:v1:progress`.
- Không backend, không đăng nhập; ghi âm chỉ giữ trong bộ nhớ.
- UI tiếng Việt; nội dung học tiếng Anh; TTS `en-US`.
- Một lượt trò = 10 câu (ít hơn nếu thiếu dữ liệu).
- Leitner: đúng → box+1 (≤5); sai → box=1, wrong+1; hạn ôn `[0,0,1,2,4,7][box]` ngày.
- Chấm nói: khớp ≥ 0.8 là đạt.

---

## File Structure

```
index.html, vite.config.ts, tsconfig.json, package.json, vercel.json
public/icon.svg, public/icon-192.png, public/icon-512.png
src/main.tsx, src/App.tsx
src/types.ts                       Lesson/Phrase/... types
src/lessons/level2-01.json         Bài 1
src/lessons/index.ts               danh sách bài, getLesson(id)
src/lessons/validate.ts            validateLesson(obj): string[] lỗi
src/lib/shuffle.ts                 shuffle, sample (random có thể seed)
src/lib/leitner.ts                 applyAnswer, isDue, DUE_DAYS
src/lib/progress.ts                load/save/useProgress, recordAnswer, streak
src/lib/picker.ts                  pickPhrases, distractors, phrasePool
src/lib/scoring.ts                 normalize, matchRatio, fuzzyEqual, blankOf
src/lib/speech.ts                  speak, hasTTS
src/lib/recognition.ts             listen, hasRecognition
src/lib/recorder.ts                useRecorder hook
src/components/*                   UI dùng chung
src/games/*.tsx + registry.ts      14 trò
src/pages/*.tsx                    màn hình
src/styles/tokens.css, base.css
tests/*.test.ts
```

---

### Task 1: Scaffold dự án + git

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `.gitignore`, `vercel.json`.

- [ ] `git init`, tạo `.gitignore` (`node_modules`, `dist`, `.DS_Store`).
- [ ] `package.json` với scripts `dev`, `build` (`tsc -b && vite build`), `preview`, `test` (`vitest run`); deps: react, react-dom, react-router-dom; devDeps: vite, @vitejs/plugin-react, typescript, @types/react, @types/react-dom, vite-plugin-pwa, vitest, jsdom, @testing-library/react.
- [ ] `vite.config.ts`: plugin react + VitePWA (`registerType: 'autoUpdate'`, manifest tên "PTALK Review", theme `#111111`, icons 192/512, `globPatterns: ['**/*.{js,css,html,svg,png,json}']`), `test: { environment: 'jsdom' }`.
- [ ] `App.tsx` render "PTALK Review" tạm. Run `npm install && npm run build` → PASS.
- [ ] Commit `chore: scaffold vite react ts pwa`.

### Task 2: Types + dữ liệu Bài 1 + validate

**Files:** Create `src/types.ts`, `src/lessons/level2-01.json`, `src/lessons/validate.ts`, `src/lessons/index.ts`; Test `tests/validate.test.ts`.

**Produces:** `Lesson, Phrase, ExtraPhrase, Dialogue, Mission, GrammarPoint, Exercise` (đúng schema spec §4); `validateLesson(x: unknown): string[]`; `lessons: Lesson[]`; `getLesson(id: string): Lesson | undefined`.

- [ ] Test:

```ts
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
  it('bài 1 có 25 cụm, 5 nhóm', () => {
    expect(lesson.phrases).toHaveLength(25)
    expect(lesson.groups).toHaveLength(5)
  })
})
```

- [ ] Run → FAIL. Viết types, JSON đầy đủ từ giáo trình (25 cụm, 2 hội thoại, 4 mission, 4 grammar × 4–5 bài tập, extraPhrases từ 4 mission), `validate.ts` kiểm tra: field bắt buộc, id trùng, group tồn tại, toolkit là substring của text, answer index hợp lệ, `blank` là substring của `en`.
- [ ] Run → PASS. Commit `feat: lesson schema, data for lesson 1, validator`.

### Task 3: shuffle + leitner

**Files:** `src/lib/shuffle.ts`, `src/lib/leitner.ts`; Test `tests/leitner.test.ts`.

**Produces:** `shuffle<T>(a: T[], rnd?: () => number): T[]`, `sample<T>(a: T[], n: number, rnd?): T[]`; `type PhraseStat = { box: number; wrong: number; seen: number; last: number }`; `DUE_DAYS = [0,0,1,2,4,7]`; `applyAnswer(s: PhraseStat | undefined, correct: boolean, now: number): PhraseStat`; `isDue(s: PhraseStat | undefined, now: number): boolean`.

- [ ] Test:

```ts
import { applyAnswer, isDue } from '../src/lib/leitner'
const DAY = 86400000
it('đúng tăng box, tối đa 5', () => {
  let s = applyAnswer(undefined, true, 0)
  expect(s.box).toBe(1)
  for (let i = 0; i < 10; i++) s = applyAnswer(s, true, 0)
  expect(s.box).toBe(5)
})
it('sai về box 1, tăng wrong', () => {
  const s = applyAnswer({ box: 4, wrong: 0, seen: 3, last: 0 }, false, 5)
  expect(s).toEqual({ box: 1, wrong: 1, seen: 4, last: 5 })
})
it('hạn ôn', () => {
  expect(isDue(undefined, 0)).toBe(true)
  expect(isDue({ box: 3, wrong: 0, seen: 1, last: 0 }, DAY)).toBe(false)
  expect(isDue({ box: 3, wrong: 0, seen: 1, last: 0 }, 2 * DAY)).toBe(true)
})
```

- [ ] FAIL → implement → PASS → commit `feat: leitner scheduling`.

### Task 4: scoring

**Files:** `src/lib/scoring.ts`; Test `tests/scoring.test.ts`.

**Produces:** `normalize(s: string): string[]` (lowercase, bỏ dấu câu, `’`→`'`, mở rộng `it's|that's|what's|i'm|you're|we're|let's|haven't|didn't|can't|won't|i've|you'll|we'll|how's|we've` ), `matchRatio(target: string, said: string): number` (LCS theo từ / số từ target), `matchedWords(target, said): boolean[]` (theo token hiển thị của target), `fuzzyEqual(a, b): 'exact' | 'near' | 'wrong'` (Levenshtein ≤1 trên chuỗi đã chuẩn hoá = near), `blankOf(p: {en: string; blank?: string}): string`.

- [ ] Test:

```ts
import { matchRatio, fuzzyEqual, normalize, blankOf } from '../src/lib/scoring'
it('normalize', () => expect(normalize("It's been ages!")).toEqual(['it','is','been','ages']))
it('khớp hoàn toàn', () => expect(matchRatio("It's been ages!", 'it is been ages')).toBe(1))
it('thiếu từ', () => expect(matchRatio('How have you been?', 'how you been')).toBeCloseTo(0.75))
it('rỗng', () => expect(matchRatio('Hi there', '')).toBe(0))
it('fuzzy', () => {
  expect(fuzzyEqual('ages', 'Ages')).toBe('exact')
  expect(fuzzyEqual('ages', 'agez')).toBe('near')
  expect(fuzzyEqual('ages', 'years')).toBe('wrong')
})
it('blankOf mặc định từ dài nhất', () => expect(blankOf({ en: 'Long time no see!' })).toBe('Long'))
it('blankOf dùng blank', () => expect(blankOf({ en: "It's been ages!", blank: 'ages' })).toBe('ages'))
```

- [ ] FAIL → implement → PASS → commit `feat: answer scoring`.

### Task 5: progress store

**Files:** `src/lib/progress.ts`; Test `tests/progress.test.ts`.

**Produces:** `type Progress` (spec §5); `KEY = 'ptalk:v1:progress'`; `loadProgress(): Progress`; `saveProgress(p)`; `recordAnswer(p, lessonId, phraseId, correct, now): Progress` (Leitner + streak); `bumpStreak(p, now): Progress`; `setBest(p, key, score): Progress`; `lessonPercent(p, lesson): number`; React hook `useProgress(): [Progress, (fn: (p: Progress) => Progress) => void]` (state trong context `ProgressProvider`, ghi localStorage sau mỗi update).

- [ ] Test streak (hôm nay → giữ, hôm qua → +1, cách 2 ngày → 1), `recordAnswer` cập nhật đúng key `lesson:phrase`, `setBest` chỉ tăng, `loadProgress` khi `localStorage.getItem` ném lỗi trả progress rỗng, `lessonPercent` = trung bình box/5.
- [ ] FAIL → implement → PASS → commit `feat: progress persistence`.

### Task 6: picker

**Files:** `src/lib/picker.ts`; Test `tests/picker.test.ts`.

**Produces:** `type Item = { id: string; en: string; vi: string; group?: string; synonym?: string; intensity?: number; situation?: string; blank?: string; extra?: boolean }`; `phrasePool(lesson, set: 'all' | 'extra' | string /*groupId*/): Item[]`; `pickItems(pool, stats: Record<string, PhraseStat>, lessonId, n, now, rnd?): Item[]` (đến hạn trước, rồi box thấp, rồi ngẫu nhiên); `distractors(target: Item, pool: Item[], n, key: (i: Item) => string | undefined, rnd?): Item[]` (ưu tiên cùng group, loại trùng giá trị key với target); `hardest(pool, stats, lessonId, n): Item[]` (sort wrong desc, box asc; chỉ các cụm đã từng sai hoặc box ≤1 và seen>0).

- [ ] Test: đến hạn được ưu tiên; không trả trùng; distractors không chứa target, không trùng giá trị, ưu tiên cùng group; hardest rỗng khi chưa có stats.
- [ ] FAIL → implement → PASS → commit `feat: question picker`.

### Task 7: speech, recognition, recorder

**Files:** `src/lib/speech.ts`, `src/lib/recognition.ts`, `src/lib/recorder.ts`.

**Produces:** `hasTTS(): boolean`; `speak(text, opts?: { voice?: 'A' | 'B'; slow?: boolean }): Promise<void>` (cancel trước khi nói, chọn voice en-US, B dùng voice thứ 2 hoặc pitch khác); `stopSpeaking()`; `hasRecognition(): boolean`; `listen(): { promise: Promise<string>; stop(): void }` (reject với `'unsupported' | 'denied' | 'no-speech' | 'network'`); `useRecorder(): { state: 'idle'|'recording'|'ready'|'unsupported'|'denied'; url?: string; start(); stop(); reset() }` (revoke object URL khi reset/unmount).

- [ ] Viết code; `npm run build` PASS (API trình duyệt, kiểm tra thủ công ở Task 14). Commit `feat: speech, recognition, recorder wrappers`.

### Task 8: styles + components dùng chung + routing

**Files:** `src/styles/tokens.css`, `src/styles/base.css`, `src/components/{Button,Card,ProgressBar,SpeakButton,MicButton,TopBar,TabBar,ResultScreen,Choices}.tsx`, `src/App.tsx`, `src/pages/Home.tsx`, `src/pages/LessonHub.tsx`.

- [ ] Tokens: `--bg --fg --muted --card --line --accent(#F5C400) --ok --bad --radius`; dark mode qua media query.
- [ ] `App`: `ProgressProvider` + HashRouter với routes spec §3. `LessonHub` = layout có `TopBar` + `<Outlet/>` + `TabBar`.
- [ ] `Home`: danh sách bài với `ProgressBar` (lessonPercent), streak 🔥.
- [ ] `Choices`: list nút đáp án, trạng thái đúng/sai sau khi chọn, gọi `onPick(index)`.
- [ ] `ResultScreen`: điểm, best, danh sách câu sai (bấm để nghe), nút Chơi lại / Ôn câu sai / Về.
- [ ] Build PASS, xem trên dev server. Commit `feat: app shell, home, shared components`.

### Task 9: GameShell + registry + PhrasesPage + trò 1, 2, 4, 5, 7

**Files:** `src/games/GameShell.tsx`, `src/games/registry.ts`, `src/games/{FlashCard,Quiz,Listen,Sort,Synonym}.tsx`, `src/pages/PhrasesPage.tsx`, `src/pages/GamePage.tsx`.

**Produces:**
```ts
type QuestionProps = { item: Item; pool: Item[]; lesson: Lesson; onAnswer: (r: { correct: boolean; points: number; itemId?: string }) => void }
type GameDef = { id: string; name: string; icon: string; tier: 'nho'|'hieu'|'dung'|'tong-hop'; desc: string;
  eligible: (i: Item) => boolean; minItems: number; perRound?: number;
  Question?: React.FC<QuestionProps>; Custom?: React.FC<CustomGameProps> }
type CustomGameProps = { lesson: Lesson; pool: Item[]; onFinish: (r: { score: number; wrong: Item[]; answers: {id: string; correct: boolean}[] }) => void }
```
- [ ] `GameShell`: lấy pool đủ điều kiện, `pickItems` 10 câu, render `Question` với `key` theo index, sau `onAnswer` gọi `recordAnswer`, hiện nút "Tiếp" (hoặc tự chuyển sau 900ms nếu đúng), cuối lượt `setBest` + `ResultScreen`. Game có `Custom` thì Shell chỉ lo kết quả.
- [ ] PhrasesPage: chọn bộ cụm (Tất cả / từng nhóm / Cụm gợi ý thêm, lưu trong query `?set=`), liệt kê trò theo tier với best score; trò không đủ `minItems` hiện khoá + lý do.
- [ ] Trò 1–2–4–5–7 theo spec §6. Chơi thử trên dev server. Commit `feat: game shell and recognition games`.

### Task 10: trò 3, 6, 8, 9

**Files:** `src/games/{Match,Situation,Sequence,Intensity}.tsx`.

- [ ] Match (Custom): 2 vòng × 5 cặp, đồng hồ, sai +3s, điểm = max(0, 300 − giây).
- [ ] Situation (Question): 3 lựa chọn từ các cụm khác nhóm + cùng nhóm.
- [ ] Sequence (Custom, 3 lượt): mỗi lượt 1 cụm/nhóm, chạm lần lượt để xếp theo `group.order`, +10/vị trí đúng; hiển thị thứ tự đúng sau khi nộp.
- [ ] Intensity (Custom, 3 lượt): 3 cụm có intensity khác nhau, xếp mạnh → nhẹ, đúng hết +30.
- [ ] Chơi thử. Commit `feat: match, situation, sequence, intensity games`.

### Task 11: trò 10, 11, 12, 13, 14

**Files:** `src/games/{Scramble,FillBlank,SpeakIt,Challenge,Review}.tsx`.

- [ ] Scramble: tách từ giữ dấu câu gắn với từ, chip xáo; bấm chip để thêm/bớt; nút Gợi ý (hiện VI); nộp: đúng lần đầu +15, dùng gợi ý +5.
- [ ] FillBlank: câu với `blankOf` thay bằng ô input, `fuzzyEqual`; exact +15, near +8 (tính đúng), wrong hiện đáp án.
- [ ] SpeakIt: VI + MicButton → `listen()`, hiện transcript với `matchedWords` tô màu, ≥0.8 +20; unsupported/denied → nghe câu mẫu rồi tự chấm Đạt/Chưa đạt.
- [ ] Challenge (Custom): trộn Question của trò quiz/listen/sort/situation/synonym/scramble/fillblank (lọc theo eligible), 3 mạng, timer 15s/câu (hết giờ = sai), combo ≥5 → ×2, kết thúc khi hết mạng hoặc hết 20 câu.
- [ ] Review (Custom): `hardest` 10 cụm → pha FlashCard rồi pha Quiz; rỗng → "Chưa có câu sai 🎉".
- [ ] Chơi thử. Commit `feat: scramble, fill, speak, challenge, review games`.

### Task 12: Role-play

**Files:** `src/pages/RoleplayPage.tsx`, `src/pages/DialoguePage.tsx`, `src/pages/MissionPage.tsx`, `src/components/ChatLine.tsx`.

- [ ] RoleplayPage: thẻ các hội thoại (3 nút Nghe / Điền cụm / Đóng vai + best) và thẻ mission (✅ nếu xong).
- [ ] DialoguePage `listen`: ChatLine A trái/B phải, toolkit in đậm, bấm câu để nghe, ▶ phát tuần tự (có Dừng), Từ mới cuối.
- [ ] `fill`: toolkit → ô trống theo thứ tự; bank nút = tất cả toolkit của hội thoại xáo trộn; chọn điền vào ô đang active; sai rung + không điền; +10/ô đúng lần đầu; lưu best.
- [ ] `act`: chọn vai; máy đọc vai kia (await speak) rồi tới lượt mình: câu mờ, 👁, mic → matchRatio; fallback tự chấm; kết quả từng câu; lưu best (% câu đạt × 100).
- [ ] MissionPage: situation, kickoff (🔊), goals checkbox lưu `progress.missions`, hints bấm nghe, nút mở sheet 5 nhóm toolkit, recorder ⏺/⏹/▶/ghi lại.
- [ ] Chơi thử. Commit `feat: roleplay dialogues and missions`.

### Task 13: Ngữ pháp

**Files:** `src/pages/GrammarPage.tsx`.

- [ ] Mỗi điểm: thẻ notes + nút "Làm bài" → từng câu (choice dùng `Choices`, input dùng `fuzzyEqual` với mọi đáp án chấp nhận) → hiện giải thích sau mỗi câu → điểm cuối, lưu best.
- [ ] Commit `feat: grammar page`.

### Task 14: PWA icons, kiểm tra toàn bộ

- [ ] `public/icon.svg` + render PNG 192/512 (dùng `sips`/`qlmanage` hoặc canvas script); `apple-touch-icon`.
- [ ] `npm test` PASS, `npm run build` PASS.
- [ ] `npm run preview`, Playwright viewport 390×844: mở Home → bài 1 → từng trò chơi 1 câu, Role-play, Ngữ pháp; kiểm tra không scroll ngang, không lỗi console; chụp màn hình.
- [ ] README: cách chạy, thêm bài mới, deploy Vercel.
- [ ] Commit `chore: pwa icons, readme`.
