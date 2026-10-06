"""Sinh audio thử: mỗi câu × giọng macOS, một bản đọc đúng (ok) và một bản cố tình đọc sai (bad)."""
import json, subprocess, os, tempfile
VOICES = ['Samantha', 'Eddy (English (US))', 'Flo (English (US))', 'Reed (English (US))']
os.makedirs('audio/synth', exist_ok=True)
S = json.load(open('sentences.json'))
for i, s in enumerate(S):
    for vi, v in enumerate(VOICES):
        for kind, text in (('ok', s['text']), ('bad', s['bad'])):
            out = f'audio/synth/{i:02d}_{vi}_{kind}.wav'
            if os.path.exists(out): continue
            with tempfile.NamedTemporaryFile(suffix='.aiff') as t:
                subprocess.run(['say', '-v', v, '-o', t.name, text], check=True)
                subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', t.name, '-ac', '1', '-ar', '16000', out], check=True)
print('done', len(os.listdir('audio/synth')))
