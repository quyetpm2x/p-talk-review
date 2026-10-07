# Nhiều nhà cung cấp AI + hạn lượt mỗi ngày (07/10/2026)

**Mục tiêu:** tăng hạn mức miễn phí (Groq → Cerebras → Gemini), Cú không "đổi tính" giữa buổi, biết lượng token đã dùng, và báo thân thiện khi người học hết lượt trong ngày.

| # | Việc | Cách làm |
|---|---|---|
| 1 | Giữ 1 nhà cung cấp cho cả buổi | App gửi `session` (id ngẫu nhiên mỗi buổi). BE nhớ `session → nhà cung cấp` trong bộ nhớ (2 giờ); chỉ đổi khi nhà đó đang nghỉ |
| 2 | Tạm nghỉ nhà đã hết hạn mức | 429: nghỉ theo `retry-after` (mặc định 60s, tối đa 24h); 5xx / mạng: 30s; 401/400 (sai key, sai model): 10 phút. Không gọi thử lại lúc đang nghỉ. 429 ngắn (≤ 2s) thử lại 1 lần cùng nhà |
| 3 | Thứ tự ưu tiên | `AI_ORDER` (mặc định `groq,cerebras,gemini`). Nhà nào thiếu key thì bỏ qua. Chỉ chuyển nhà khi **chưa** stream chữ nào cho học sinh |
| 4 | Sửa định dạng | Giữ `parseMeta` (JSON hỏng → dữ liệu phụ rỗng) cho mọi nhà; bỏ `delta.reasoning` |
| 5 | Đo token / lỗi | Collection `ai_usage` (`_id = YYYY-MM-DD:provider`): calls, ok, rateLimited, errors, tokensIn, tokensOut (lấy `usage`/`x_groq.usage`, thiếu thì ước lượng ký tự/4), tự xoá sau 90 ngày. Xem: `GET /admin/ai-usage?days=7` (header `x-admin-key`) |
| 6 | Hạn lượt/ngày | `TALK_DAILY_LIMIT` mặc định 80 → **25**. Lượt lỗi không bị trừ. Hết lượt → 429 `{code:'quota'}` → app hiện thẻ "Bạn đã hết lượt luyện nói hôm nay — Cú hẹn bạn vào ngày mai"; còn ≤ 3 lượt → nhắc nhẹ |

## Biến môi trường mới (BE)
| Biến | Mặc định |
|---|---|
| `CEREBRAS_API_KEY` | (trống = không dùng) |
| `CEREBRAS_MODEL` | `qwen-3.8-27b` (cùng mô hình với Groq → giọng Cú giống nhau) |
| `GEMINI_API_KEY` | (trống = không dùng) |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` |
| `*_REASONING` | Qwen `none`, gpt-oss `low`, Gemini 2.5 `none`, Gemini khác `low` |
| `*_BASE_URL` | API thật của từng hãng |
| `AI_ORDER` | `groq,cerebras,gemini` |
| `TALK_DAILY_LIMIT` | `25` |

**Lưu ý:** Gemini gói miễn phí dùng dữ liệu hội thoại để huấn luyện → để cuối danh sách.

Kiểm: vitest (chuyển nhà khi 429, giữ nhà theo buổi, nghỉ nhà lỗi, không chuyển khi đã stream, ghi `ai_usage`, hết lượt trả `code: quota`, lượt lỗi không bị trừ); tsc app + BE.
