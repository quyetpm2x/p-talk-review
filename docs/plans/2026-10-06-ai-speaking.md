# Kế hoạch: Luyện nói với AI (sửa phát âm + từ mới + giao tiếp tự do)

> Tham khảo trải nghiệm: app Praktika (ảnh bạn gửi 06/10). Mục tiêu: học sinh nói chuyện với gia sư AI theo chủ đề bài học, được chấm phát âm tới từng âm, gom từ mới vào sổ ôn tập Leitner sẵn có.

## Yêu cầu đã chốt
| Mục | Yêu cầu |
|---|---|
| Chấm phát âm | Chỉ cần kết quả kỹ thuật dạng **"âm /θ/ trong *think* bị đọc thành /t/"** (không cần AI viết lời khuyên) · **miễn phí, mã nguồn mở** |
| Giao tiếp | **Phản hồi nhanh, nhẹ, tự nhiên**; theo chủ đề; chi phí ~0 |
| Từ mới | Từ/cụm gia sư dạy hoặc sửa → lưu lại để ôn |

---

## Phần A — Chấm phát âm (mã nguồn mở, chạy trên máy học sinh)

### Thành phần
| Thành phần | Vai trò | Giấy phép |
|---|---|---|
| `facebook/wav2vec2-lv-60-espeak-cv-ft` (Meta, ~457k lượt tải/tháng) | Nghe audio → xác suất từng **âm vị IPA** theo từng khung 20ms | Apache-2.0 |
| Bản nén int8 (vd. `duyentq/sonari-wav2vec2-phoneme-int8`, ~300MB) | Chạy được trên điện thoại | theo repo |
| **eSpeak-ng** | Câu mẫu → chuỗi âm vị chuẩn (*think* → θ ɪ ŋ k). Dùng đúng eSpeak vì mô hình được huấn luyện với bộ ký hiệu của eSpeak | GPL (chỉ dùng **lúc soạn bài** để sinh IPA, không đóng vào app) |
| OpenPronounce | Tham khảo thuật toán so khớp | MIT |
| ONNX Runtime | Chạy mô hình trong app (WebView: `onnxruntime-web` WASM/WebGPU) | MIT |

### Luồng xử lý một câu
1. **Chuẩn bị (lúc soạn bài, không phải lúc học):** mọi câu mẫu trong bài được chạy qua eSpeak → lưu sẵn IPA từng từ vào JSON bài học. Câu tự do của học sinh: tra từ điển IPA đóng gói (~3MB) cho các từ thường gặp.
2. **Ghi âm** 16kHz mono (đã có bộ ghi âm; thêm bước đổi sang PCM).
3. **Mô hình** trả ma trận xác suất âm vị theo thời gian.
4. **Hai phép đo, chỉ báo lỗi khi cả hai cùng đồng ý** (giảm báo nhầm):
   - **(a) Nhận tự do + so khớp:** giải mã chuỗi âm vị nghe được (`aɪ t ɪ ŋ k`) rồi gióng với chuỗi chuẩn (`aɪ θ ɪ ŋ k`) bằng thuật toán gióng hàng có trọng số âm học (θ–t gần nhau hơn θ–m) → ra **thay thế / mất âm / thừa âm**.
   - **(b) GOP (Goodness of Pronunciation):** ép gióng chuỗi chuẩn vào audio (CTC forced alignment) → mỗi âm chuẩn có một đoạn thời gian → điểm GOP = xác suất âm đúng so với âm cạnh tranh mạnh nhất. GOP thấp + âm cạnh tranh là /t/ → "θ bị đọc thành t".
5. **Điểm:** âm → từ → câu: *độ chính xác* (trung bình GOP), *độ hoàn chỉnh* (tỉ lệ âm có mặt), *độ trôi chảy* (khoảng lặng, tốc độ nói).
6. **Kết quả trả về** (JSON) → giao diện tô đỏ từ sai, liệt kê lỗi:
   ```json
   { "score": 82, "accuracy": 78, "completeness": 100, "fluency": 90,
     "words": [{ "word": "think", "score": 45,
       "errors": [{ "expected": "θ", "heard": "t", "type": "substitution", "confidence": 0.91 }] }] }
   ```
   → hiển thị: **"âm /θ/ trong *think* bị đọc thành /t/"**, nút nghe giọng mẫu (Kokoro) và nghe lại giọng mình.

### Độ chuẩn kỳ vọng
- Bắt tốt lỗi rõ của người Việt: /θ/→/t/, /ð/→/d/, /ʃ/→/s/, /z/→/s/, mất phụ âm cuối (/k/, /t/, /s/), cụm phụ âm.
- Kém hơn với nguyên âm gần nhau (/ɪ/–/iː/, /æ/–/e/) và giọng trẻ nhỏ → chỉ hiện lỗi có `confidence` cao; lỗi mờ chỉ trừ điểm, không gọi tên.
- Thấp hơn Azure một bậc — **phải thử thật trước** (bước A0).

### Chạy ở đâu
| Nơi | Chi phí | Ghi chú |
|---|---|---|
| **Trên điện thoại** (mặc định) | 0 | Tải mô hình ~300MB một lần sau khi đăng nhập (không nằm trong app trên store). Ước tính 1–3 giây/câu trên iPhone 12+; cần đo |
| Máy chủ dự phòng (Hugging Face Space CPU miễn phí) | 0 | Cho máy yếu; chậm hơn, có lúc "ngủ" |

---

## Phần B — Giao tiếp tự do: nhanh, nhẹ, tự nhiên

### Vì sao không chạy AI hội thoại trên điện thoại
Mô hình ngôn ngữ trên máy cần tải 1–1,5GB và trả lời chậm trên máy tầm trung → **trái với "nhanh, nhẹ"**. Chọn kiến trúc nhẹ trên máy, "bộ não" trên mây:

```
Học sinh nói ─► Nhận giọng NATIVE trên máy (miễn phí, có chữ tạm theo thời gian thực)
            ─► im lặng ~0,8s ─► gửi chữ lên PTalk-be ─► LLM nhanh (trả từng chữ - streaming)
            ─► có câu đầu tiên là đọc ngay bằng giọng NATIVE (không đợi hết đoạn)
```
- **Độ trễ cảm nhận ~1–1,5 giây** (nhận giọng cục bộ + chữ đầu tiên từ LLM ~0,3–0,6s + đọc ngay câu đầu).
- **Nhẹ:** app không tải mô hình nào cho phần này; mỗi lượt chỉ gửi vài trăm byte chữ.
- **Tự nhiên:** gia sư nói câu ngắn, hỏi lại một câu mở, chêm câu khen; học sinh có thể **chạm để ngắt** gia sư đang nói.

### Chọn "bộ não" (thay được, không phải viết lại app)
| Giai đoạn | Nhà cung cấp | Chi phí | Lưu ý |
|---|---|---|---|
| Phát triển + demo | **Gemini Flash gói miễn phí** | 0 | ~1.500 lượt/ngày cho cả dự án; Google được dùng dữ liệu để huấn luyện → **không dùng cho học sinh thật** |
| Học sinh thật | **Gemini Flash-Lite trả phí** (hoặc Groq/Llama) | Ước tính vài chục USD/tháng cho ~200 học sinh × 1 phiên/ngày (kiểm tra lại giá chính thức) | Dữ liệu không bị dùng huấn luyện; nhanh |
| Khi có ngân sách | Gemini Live / OpenAI Realtime (giọng nói trực tiếp) | ~0,1–0,5 USD/phiên 5 phút | Tự nhiên nhất, ngắt lời thật |

Khoá API chỉ nằm trên PTalk-be (Railway). Giới hạn mỗi học sinh (vd. 80 lượt/ngày) để không vượt chi phí.

### Mỗi lượt LLM trả về dạng có cấu trúc
```json
{ "reply": "Nice! Where in Vietnam are you from?",
  "reply_vi": "Hay quá! Bạn ở đâu tại Việt Nam?",
  "fix": { "said": "I from Vietnam", "better": "I'm from Vietnam" },
  "new_words": [{ "en": "hometown", "vi": "quê nhà", "example": "My hometown is Hue." }] }
```
→ hiển thị câu gia sư + nút dịch, thẻ "nói đúng hơn", thẻ từ mới; **chỉ đọc to `reply`**.

---

## Phần C — Từ mới
- Lấy từ `new_words` của gia sư và các cụm học sinh được sửa.
- Lưu vào **Sổ từ của tôi** = mục mới trong tiến độ (đồng bộ máy chủ như phần còn lại) → dùng **Leitner sẵn có**: đến hạn ôn thì xuất hiện trong Thẻ lật / Điền từ.
- Cuối phiên: danh sách từ mới, chạm để nghe (giọng native) và "Lưu tất cả".

---

## Phần D — Màn hình (theo phong cách PTalk navy–vàng, Cú PTALK làm gia sư)
1. **Thiết lập lần đầu (3 bước, đổi được sau):** chủ đề quan tâm · tốc độ gia sư (0,7× / 0,9× / 1,0× / 1,2×, chạm nghe thử) · giọng gia sư (giọng native nam/nữ có trên máy).
2. **Phòng nói chuyện:**
   - Cú PTALK ở trên, mấp máy khi đang nói (hiệu ứng CSS, không cần mô hình 3D).
   - Hai chế độ: **Bài giảng** (Cú dạy cụm từ của bài, bảo học sinh nhắc lại → chấm phát âm) và **Trò chuyện tự do** (theo chủ đề, dùng từ khoá của bài).
   - Bong bóng gia sư: nút 🌐 dịch, 🔊 nghe lại. Bong bóng học sinh: chip **"Phát âm 82"** → mở bảng chi tiết (điểm tổng, chính xác, trôi chảy, hoàn chỉnh, danh sách lỗi âm).
   - Hàng nút dưới: ⌨️ gõ phím · 🎤 nói · ✨ gợi ý câu trả lời.
3. **Tổng kết phiên:** số lượt nói, cụm từ của bài đã dùng, lỗi âm hay gặp nhất, từ mới, +XP và nhiệm vụ ngày (dùng hệ XP sẵn có).

---

## Các bước & thời gian
| Bước | Nội dung | Ước lượng | Cổng quyết định |
|---|---|---|---|
| **A0** | **Thử chấm phát âm trên Mac** (Python): 20 câu thật bài 1–2, eSpeak + mô hình Meta + 2 phép đo → trang HTML hiện lỗi từng âm. Bạn tự đọc đúng và **cố tình đọc sai** (/θ/→/t/, bỏ âm cuối) để xem bắt có đúng không | 2 ngày | Báo nhầm ít, bắt được lỗi cố tình → làm tiếp A2; không đạt → cân nhắc Azure |
| B1 | Backend `/talk/turn` (streaming) + bộ chọn nhà cung cấp + giới hạn lượt; app: phòng nói chuyện, nhận giọng/đọc native, đọc theo câu, ngắt lời, dịch, gợi ý, tổng kết | 4–5 ngày | |
| A2 | Chấm phát âm trong app: ONNX int8, tải mô hình sau đăng nhập, bảng chi tiết, sinh IPA cho mọi câu của bài | 4–6 ngày | Đo tốc độ trên iPhone thật + Android tầm thấp |
| C1 | Sổ từ của tôi + Leitner; thiết lập lần đầu (chủ đề, tốc độ, giọng) | 2–3 ngày | |
| **Tổng** | | **≈ 2,5–3 tuần** | |

## Rủi ro
| Rủi ro | Xử lý |
|---|---|
| Mô hình nguồn mở báo nhầm nhiều với giọng trẻ em | A0 đo trước; chỉ hiện lỗi chắc chắn; ngưỡng tinh chỉnh theo dữ liệu thật |
| Chấm trên máy yếu quá chậm | Dự phòng máy chủ miễn phí; hoặc chỉ chấm khi học sinh mở bảng chi tiết |
| Giọng native trên một số máy Android nghe kém | Cho chọn giọng; sau này có thể đổi sang giọng mây |
| Chi phí LLM vượt dự kiến | Giới hạn lượt/ngày/học sinh; câu trả lời ngắn; theo dõi trên Railway/Google |
| Dữ liệu giọng trẻ em (Nghị định 13/2023) | Chấm phát âm chạy trên máy, **không gửi âm thanh lên mây**; hội thoại chỉ gửi chữ; điều khoản đồng ý của phụ huynh khi đăng ký |
| eSpeak là GPL | Chỉ dùng trong công cụ soạn bài để sinh IPA, không đóng vào app phát hành |

---

## CẬP NHẬT 06/10 — Phương án MIỄN PHÍ, độ chính xác "chấp nhận được"

### Phát âm: thu hẹp câu hỏi để tăng độ chính xác
- Thực tế đo được của nguồn mở: GOP trên wav2vec2 tương quan với giám khảo người chỉ ~0,43 (repo phoneme-mispronunciation-detection, speechocean762); nghiên cứu tốt nhất ~0,60–0,66. → **Không đủ để cho điểm số lẻ kiểu 96,8**, nhưng **đủ để phát hiện lỗi rõ**.
- Thiết kế 2 tầng:
  1. **Tầng từ (rất chắc, 0đ, tức thì):** nhận giọng native so với câu mẫu → từ nào máy không nhận ra = "chưa rõ".
  2. **Tầng âm (chỉ trên các từ cần soi):** mô hình âm vị nguồn mở chỉ kiểm **danh sách lỗi điển hình của người Việt** (~10 cặp: θ→t, ð→d, ʃ→s, ʒ→z, z→s, v→j/b, mất phụ âm cuối k/t/s/d, mất s số nhiều, l↔n đầu từ, nguyên âm dài/ngắn chỉ cảnh báo nhẹ). Chỉ báo khi xác suất âm thay thế áp đảo.
- Hiển thị 3 mức theo từ (Tốt / Khá / Cần luyện) + câu lỗi "/θ/ trong *think* → /t/"; không hiện điểm lẻ.
- Mô hình thử ở A0: **ZIPA-CR-small (65M tham số, nhẹ, hợp điện thoại)** so với **wav2vec2-lv-60-espeak int8 (~300M)**; chọn cái bắt lỗi cố tình tốt hơn. (Kiểm giấy phép ZIPA trước khi dùng thương mại.)

### Giao tiếp: Groq gói miễn phí
- Nhận giọng native → **Groq `llama-3.1-8b-instant` (miễn phí)** → đọc bằng giọng native; trả theo luồng, đọc câu đầu ngay.
- Vì sao Groq: cực nhanh, **không dùng dữ liệu để huấn luyện, mặc định không lưu** (phù hợp dữ liệu trẻ em hơn Gemini miễn phí).
- Hạn mức miễn phí (cả tổ chức): 30 lượt/phút, 6.000 token/phút, 14.400 lượt/ngày (bản 70B: 1.000 lượt/ngày).
  - 200 học sinh × 15 lượt/ngày = 3.000 lượt → **trong hạn mức ngày**.
  - Nút thắt là **6.000 token/phút** → giữ mỗi lượt ~500–700 token (lời nhắc gọn, chỉ nhớ 6 lượt gần nhất) → chịu được ~8–10 học sinh nói cùng lúc; đông hơn thì xếp hàng 1–3 giây.
- Cloudflare Workers AI miễn phí chỉ ~15–25 lượt/ngày → loại. Gemini miễn phí chỉ dùng khi phát triển.
- Lối thoát khi đông: Groq trả phí bản 8B rất rẻ (vài USD/tháng cho ~200 học sinh) — không phải sửa app.
