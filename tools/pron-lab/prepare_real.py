"""Chuyển file ghi âm thật (m4a/mp3/wav từ iPhone) sang wav 16kHz mono cho evaluate.py.
Đặt file vào audio/raw/ với tên: NN_<tên>_ok.m4a  hoặc  NN_<tên>_bad.m4a   (NN = số câu 00–19 trong sentences.json)
  python prepare_real.py && python evaluate.py audio/real
"""
import glob, os, subprocess
os.makedirs('audio/real', exist_ok=True)
for f in sorted(glob.glob('audio/raw/*')):
    name = os.path.splitext(os.path.basename(f))[0]
    out = f'audio/real/{name}.wav'
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', f, '-ac', '1', '-ar', '16000', out], check=True)
    print('→', out)
