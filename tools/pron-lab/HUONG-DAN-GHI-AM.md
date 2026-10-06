# Hướng dẫn ghi âm thử chấm phát âm (P0)

Ghi bằng ứng dụng **Ghi âm** của iPhone, nơi yên tĩnh, cầm máy cách miệng ~20cm. Mỗi câu ghi **2 file**:
- `NN_<tên>_ok.m4a` — đọc **chuẩn nhất có thể**
- `NN_<tên>_bad.m4a` — **cố tình đọc sai** đúng như cột “Đọc sai thế này”

Ví dụ: `00_quyet_ok.m4a`, `00_quyet_bad.m4a`. Chép tất cả vào `tools/pron-lab/audio/raw/`.
Có thể nhờ thêm 1–2 người (học sinh/giáo viên) ghi với tên khác (`00_lan_ok.m4a`) — càng nhiều giọng thật, ngưỡng càng chuẩn.

| NN | Câu chuẩn | Đọc sai thế này | Lỗi cần bắt |
|---|---|---|---|
| 00 | These things happen. | Dese tings happen. | /ð/ trong *These* → /d/; /θ/ trong *things* → /t/ |
| 01 | That sounds really hard. | Dat sound really har. | /ð/ trong *That* → /d/; /z/ trong *sounds* → mất âm; /d/ trong *hard* → mất âm |
| 02 | I'm so sorry to hear that. | I'm so sorry to hear dat. | /ð/ trong *that* → /d/ |
| 03 | It's not your fault. | It's not your faw. | /t/ trong *fault* → mất âm |
| 04 | You did everything you could. | You did everyting you could. | /θ/ trong *everything* → /t/ |
| 05 | What a small world! | What a small worl! | /d/ trong *world* → mất âm |
| 06 | How's the family? | How's de family? | /ð/ trong *the* → /d/ |
| 07 | That must be so stressful. | Dat must be so stressful. | /ð/ trong *That* → /d/ |
| 08 | Is something on your mind? | Is someting on your mine? | /θ/ trong *something* → /t/; /d/ trong *mind* → mất âm |
| 09 | I can imagine how hard this must be for you. | I can imagine how hard dis must be for you. | /ð/ trong *this* → /d/ |
| 10 | You haven't changed a bit! | You haven't change a bit! | /d/ trong *changed* → mất âm |
| 11 | What have you been up to? | What hab you been up to? | /v/ trong *have* → /b/ |
| 12 | Long time no see! | Lon time no see! | /ŋ/ trong *Long* → /n/ |
| 13 | She shares her feelings. | See sares her feelings. | /ʃ/ trong *She* → /s/; /ʃ/ trong *shares* → /s/ |
| 14 | I think so. | I sink so. | /θ/ trong *think* → /s/ |
| 15 | Very nice to meet you. | Bery nice to meet you. | /v/ trong *Very* → /b/ |
| 16 | It's so good to see you again! | It's so goo to see you again! | /d/ trong *good* → mất âm |
| 17 | I like it. | I lie it. | /k/ trong *like* → mất âm |
| 18 | Thank you so much. | Tank you so much. | /θ/ trong *Thank* → /t/ |
| 19 | Don't be too hard on yourself. | Don't be too har on yourself. | /d/ trong *hard* → mất âm |

Chạy:
```bash
cd tools/pron-lab && . .venv/bin/activate
python prepare_real.py
python evaluate.py audio/real          # chấm bằng ngưỡng hiện tại
python evaluate.py audio/real --fit    # hiệu chỉnh lại ngưỡng theo giọng thật
open report.html
```
