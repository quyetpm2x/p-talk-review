# PTALK Review — Web ôn luyện sau buổi học (Design Spec)

- Ngày: 2026-09-22
- Trạng thái: Đã duyệt thiết kế, chờ review spec

## 1. Mục tiêu

Web mobile-first để học sinh PTALK English ôn lại nội dung mỗi buổi học giao tiếp. Mỗi bài gồm 3 phần như giáo trình: **Kho cụm từ** (trọng tâm), **Role-play**, **Ngữ pháp**. Học sinh ôn qua nhiều trò chơi đa dạng.

Phạm vi v1:
- 14 trò chơi cho Kho cụm từ.
- Role-play đầy đủ: hội thoại mẫu (nghe / điền cụm / đóng vai bằng giọng nói) và thẻ nhiệm vụ (có ghi âm).
- Ngữ pháp: giải thích + bài tập.
- Dữ liệu Bài 1 "Meeting Again" (Level 2) nhập từ giáo trình.

Ngoài phạm vi v1: tài khoản / đăng nhập, backend, dashboard giáo viên, lưu bản ghi âm, trang admin nhập bài.

## 2. Quyết định kỹ thuật

| Mục | Quyết định |
|---|---|
| Stack | React + TypeScript + Vite |
| PWA | Có — `vite-plugin-pwa`, cài lên màn hình chính, precache app shell + lesson JSON để chạy offline |
| Routing | `react-router-dom` (HashRouter để host tĩnh không cần rewrite) |
| Style | CSS thuần với CSS variables (tokens), không dùng UI framework |
| Lưu trữ | `localStorage`, bọc try/catch; lỗi → chạy không lưu |
| Host | Vercel (static) |
| Test | Vitest cho logic thuần; kiểm tra thủ công/Playwright ở viewport mobile |

## 3. Cấu trúc màn hình

```
/                         Trang chủ: danh sách bài, % tiến độ, streak 🔥
/lesson/:id               Hub bài học, 3 tab dưới đáy
  /lesson/:id/phrases     Kho cụm từ: chọn bộ cụm + danh sách 14 trò (nhóm Nhớ / Hiểu / Dùng / Tổng hợp)
  /lesson/:id/phrases/:game   Màn chơi
  /lesson/:id/roleplay    Danh sách hội thoại mẫu + thẻ nhiệm vụ
  /lesson/:id/roleplay/dialogue/:idx/:mode   mode = listen | fill | act
  /lesson/:id/roleplay/mission/:idx
  /lesson/:id/grammar     Thẻ giải thích + bài tập
```

## 4. Dữ liệu bài học

Mỗi bài một file `src/lessons/<id>.json`, đăng ký trong `src/lessons/index.ts`. Schema (TypeScript, validate lúc load bằng hàm kiểm tra thủ công):

```ts
type Lesson = {
  id: string; level: number; number: number;
  title: string; titleVi: string;
  objectives: string[];
  groups: { id: string; en: string; vi: string; order: number }[]; // order = trình tự cuộc gặp
  phrases: Phrase[];
  extraPhrases: { id: string; en: string; vi: string; source?: string }[];
  dialogues: Dialogue[];
  missions: Mission[];
  grammar: GrammarPoint[];
};
type Phrase = {
  id: string; group: string; en: string; vi: string;
  synonym?: string;      // cụm đồng nghĩa
  intensity?: 1 | 2 | 3; // độ bất ngờ (trò 9), chỉ nhóm surprise
  blank?: string;        // từ khoá bị ẩn ở trò 11; mặc định = từ dài nhất
  situation?: string;    // tình huống tiếng Việt (trò 6)
  note?: string;         // ghi chú sắc thái
};
type Dialogue = {
  title: string; setting: string;
  lines: { speaker: 'A' | 'B'; text: string; toolkit: string[] }[]; // toolkit = cụm gạch chân, là substring của text
  newWords: { en: string; meaning: string; vi: string }[];
};
type Mission = {
  title: string; level: 'nhẹ' | 'thường' | 'tổng hợp';
  situation: string; kickoff: string; goals: string[];
  hints: { en: string; vi: string }[];
};
type GrammarPoint = {
  title: string; notes: string[];
  exercises: ({ type: 'choice'; q: string; options: string[]; answer: number; explain: string }
            | { type: 'input'; q: string; answers: string[]; explain: string })[];
};
```

Trường tuỳ chọn thiếu → trò tương ứng bỏ qua cụm đó. Trò nào không đủ dữ liệu tối thiểu (vd. < 4 cụm có `synonym`) thì hiện ở trạng thái khoá, kèm lý do.

Bài 1 lấy từ giáo trình: 25 cụm (5 nhóm × 5), 2 hội thoại mẫu, 4 thẻ nhiệm vụ, 4 điểm ngữ pháp, các "Cụm gợi ý thêm" làm `extraPhrases`. `intensity` nhóm Surprise theo ghi chú tay: What are the odds! = 3, No way! = 2, Fancy running into you here! = 1. Câu bài tập ngữ pháp và `situation` do người làm soạn thêm, bám sát giáo trình.

## 5. Tiến độ (localStorage)

Key `ptalk:v1:progress`:

```ts
type Progress = {
  phrases: Record<string /* lessonId:phraseId */, { box: 0|1|2|3|4|5; wrong: number; seen: number; last: number }>;
  bestScores: Record<string /* lessonId:gameId */, number>;
  missions: Record<string /* lessonId:idx */, boolean[]>; // goals đã tick
  dialogues: Record<string /* lessonId:idx:mode */, number>; // điểm cao nhất
  grammar: Record<string /* lessonId:idx */, number>;
  streak: { count: number; lastDay: string /* YYYY-MM-DD */ };
};
```

- Leitner: đúng → `box+1` (tối đa 5); sai → `box=1`, `wrong+1`.
- "Đến hạn" ôn: box 0–1 luôn đến hạn; box n đến hạn sau `[0,0,1,2,4,7][n]` ngày kể từ `last`.
- % tiến độ bài = trung bình `box/5` các cụm.
- Streak: có ít nhất 1 câu trả lời trong ngày → cập nhật; cách > 1 ngày → reset về 1.

## 6. Kho cụm từ — 14 trò

Luật chung:
- Một lượt 10 câu (hoặc ít hơn nếu thiếu dữ liệu). Chọn cụm ưu tiên: đến hạn → box thấp → ngẫu nhiên.
- Đáp án nhiễu lấy từ cùng bài, ưu tiên cùng nhóm, không trùng đáp án đúng.
- Sau mỗi câu: hiệu ứng đúng/sai, đọc cụm đúng (TTS), cập nhật Leitner.
- Màn kết quả: điểm, danh sách câu sai (bấm để nghe), nút *Chơi lại* / *Ôn câu sai*.
- Bộ cụm chọn trước khi chơi: Tất cả / 1 nhóm / Cụm gợi ý thêm. `extraPhrases` chỉ dùng ở trò 1, 2, 4, 10, 11, 12.

| # | Trò | Cơ chế | Điểm |
|---|---|---|---|
| 1 | Thẻ lật | Mặt trước EN + 🔊; chạm/vuốt lật → synonym + VI; *Nhớ rồi* / *Chưa nhớ* | Chỉ Leitner |
| 2 | Trắc nghiệm | Mỗi câu random VI→EN hoặc EN→VI, 4 lựa chọn | +10 |
| 3 | Nối cặp | 5 EN × 5 VI, 2 vòng, bấm giờ | Thời gian; sai +3s |
| 4 | Nghe & chọn | TTS đọc (nút nghe lại, đọc chậm), chọn EN hoặc nghĩa VI trong 4 | +10 |
| 5 | Phân nhóm | Hiện 1 cụm, chạm 1 trong 5 nút nhóm | +10 |
| 6 | Hợp tình huống | Hiện `situation`, chọn 1 trong 3 câu | +10 |
| 7 | Đồng nghĩa | Cho `en`, chọn `synonym` đúng trong 4 (hoặc ngược lại) | +10 |
| 8 | Xếp cuộc gặp | 5 cụm (mỗi nhóm 1) bị xáo; chạm lần lượt để xếp theo `group.order` | +10 / vị trí đúng |
| 9 | Thang bất ngờ | 3 cụm có `intensity`, xếp mạnh → nhẹ | Đúng hết +30 |
| 10 | Sắp xếp từ | Từ bị xáo thành chip, chạm để ghép câu; gợi ý = nghĩa VI | +15 lần đầu; dùng gợi ý +5 |
| 11 | Điền từ | Câu với `blank` ẩn, gõ từ; không phân biệt hoa thường/dấu câu; lệch 1 ký tự = gần đúng | +15 / +8 |
| 12 | Nói ra | Hiện VI, bấm mic, nói EN; hiện transcript, tô từ khớp | Khớp ≥ 80% +20; fallback tự chấm |
| 13 | Thử thách nhanh | Trộn trò 2, 4, 5, 6, 7, 10, 11; 3 mạng ❤️; 15s/câu; combo ≥ 5 → ×2 | Lưu best score |
| 14 | Ôn câu hay sai | 10 cụm `wrong` cao nhất / box thấp nhất → Thẻ lật rồi Trắc nghiệm; rỗng → "Chưa có câu sai 🎉" | Như trò 1, 2 |

## 7. Role-play

Hội thoại mẫu, 3 chế độ:
- **Nghe:** giao diện chat (A trái, B phải), cụm toolkit in đậm; bấm câu để nghe, ▶ nghe cả bài; 2 giọng khác nhau nếu thiết bị có; "Từ mới" ở cuối.
- **Điền cụm:** cụm toolkit thành ô trống; chọn cụm đúng từ các nút bên dưới; +10 / ô.
- **Đóng vai:** chọn vai A/B; máy đọc vai kia; tới lượt mình câu mẫu bị làm mờ (👁 gợi ý), bấm mic nói, chấm như trò 12; cuối bài hiện điểm từng câu. Fallback: đọc to + tự bấm Đạt / Chưa đạt.

Thẻ nhiệm vụ:
- Tình huống + câu mở đầu (🔊), danh sách mục tiêu có checkbox (lưu tiến độ), cụm gợi ý thêm (bấm để nghe), nút mở nhanh 5 nhóm toolkit.
- Ghi âm bằng `MediaRecorder`: ⏺ / ⏹ / nghe lại, ghi lại nhiều lần; chỉ giữ trong bộ nhớ, mất khi rời trang.
- Tick đủ mục tiêu → ✅ Hoàn thành.

## 8. Ngữ pháp

4 thẻ giải thích (nội dung giáo trình) + mỗi điểm 4–5 câu bài tập (trắc nghiệm / điền từ). Làm xong hiện điểm và giải thích từng câu. Lưu điểm cao nhất.

## 9. Giọng nói

- `speech.ts` bọc `speechSynthesis`: chọn giọng `en-US` (ưu tiên giọng chất lượng cao nếu có), tốc độ 1.0 / 0.7, hàm `speak(text, {voice: 'A'|'B', slow})`. Không có TTS → ẩn nút 🔊.
- `recognition.ts` bọc `SpeechRecognition`/`webkitSpeechRecognition`, `lang='en-US'`, trả transcript. Không hỗ trợ / bị từ chối quyền → trả trạng thái để UI chuyển sang tự chấm.
- Chấm khớp: chuẩn hoá (lowercase, bỏ dấu câu, mở rộng viết tắt cơ bản như `it's → it is`), tỉ lệ = số từ của câu mẫu xuất hiện theo thứ tự trong transcript (LCS theo từ) / số từ câu mẫu.
- Nhận diện giọng nói trên Chrome cần mạng; offline → fallback tự chấm.

## 10. Giao diện

- Tông đen/trắng như giáo trình PTALK, 1 màu nhấn vàng cho nút chính và điểm. Dark mode theo `prefers-color-scheme`.
- Mobile-first: vùng chạm ≥ 44px, bố cục 1 cột, tab bar đáy (Cụm từ / Role-play / Ngữ pháp), max-width ~480px căn giữa trên desktop.
- Animation ngắn khi đúng/sai; `navigator.vibrate` nếu có; tôn trọng `prefers-reduced-motion`.
- Header dùng slogan "Speak with mastery".

## 11. Cấu trúc code

```
src/
  lessons/            level2-01.json, index.ts, validate.ts
  lib/                progress.ts, leitner.ts, picker.ts (chọn câu + đáp án nhiễu),
                      scoring.ts (fuzzy/LCS), speech.ts, recognition.ts, recorder.ts, shuffle.ts
  components/         Button, Card, ProgressBar, SpeakButton, MicButton, ResultScreen, GameShell, TabBar
  games/              FlashCard, Quiz, Match, Listen, Sort, Situation, Synonym, Sequence,
                      Intensity, Scramble, FillBlank, SpeakIt, Challenge, Review, registry.ts
  pages/              Home, LessonHub, PhrasesPage, GamePage, RoleplayPage, DialoguePage,
                      MissionPage, GrammarPage
  styles/             tokens.css, base.css
```

`games/registry.ts` khai báo mỗi trò: `id`, tên, nhóm, icon, điều kiện dữ liệu tối thiểu, component. `GameShell` lo khung chung (tiến trình câu, điểm, màn kết quả); mỗi trò chỉ render một câu hỏi và báo `onAnswer(correct, phraseId)`.

## 12. Kiểm thử

- Vitest: `leitner`, `picker` (ưu tiên đến hạn, đáp án nhiễu không trùng), `scoring` (khớp ≥ 80%, gần đúng 1 ký tự), `progress` (streak, localStorage lỗi), `validate` (Bài 1 hợp lệ; toolkit là substring của line).
- Chạy ở viewport 390×844, chơi qua từng trò, chụp màn hình cho người dùng xem.
- `npm run build` sạch, Lighthouse PWA installable.

## 13. Thêm bài mới

1. Tạo `src/lessons/<id>.json` theo schema.
2. Thêm vào `src/lessons/index.ts`.
3. `npm test` (validate) → deploy.
