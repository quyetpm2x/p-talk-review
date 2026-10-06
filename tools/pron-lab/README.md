# pron-lab — thử nghiệm chấm phát âm (P0)

Công cụ chạy trên máy dev (không đóng vào app). Mô hình: `duyentq/sonari-wav2vec2-phoneme-int8` (ONNX 355MB, Apache-2.0).

```bash
cd tools/pron-lab
python3 -m venv .venv && . .venv/bin/activate
pip install onnxruntime numpy soundfile phonemizer espeakng-loader
mkdir -p model
curl -L -o model/vocab.json https://huggingface.co/facebook/wav2vec2-lv-60-espeak-cv-ft/resolve/main/vocab.json
curl -L -o model/wav2vec2_int8.onnx https://huggingface.co/duyentq/sonari-wav2vec2-phoneme-int8/resolve/main/wav2vec2_int8.onnx
python make_dataset.py        # audio thử bằng giọng macOS (4 giọng × 20 câu × đúng/sai)
python evaluate.py            # đánh giá chéo + hiệu chỉnh ngưỡng → thresholds.json, report.html
```

| File | Vai trò |
|---|---|
| `pron.py` | Thuật toán: IPA (eSpeak NG) → mô hình → CTC log-likelihood → kiểm từng giả thuyết lỗi (θ→t, mất âm cuối…) |
| `sentences.json` | 20 câu thử + kịch bản đọc sai |
| `en_inventory.json` | Bộ 57 âm tiếng Anh (chặn ký hiệu tiếng khác) — app dùng lại đúng file này |
| `thresholds.json` | Ngưỡng từng cặp lỗi đã hiệu chỉnh — app dùng lại |
| `HUONG-DAN-GHI-AM.md` | Hướng dẫn ghi âm thật để kiểm |

eSpeak NG lấy từ gói pip `espeakng-loader` (không cần cài hệ thống). eSpeak là GPL → chỉ dùng ở công cụ này để sinh IPA, không đóng vào app.
