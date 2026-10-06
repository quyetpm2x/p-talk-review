"""Phân tích báo nhầm/bỏ sót theo từng cặp lỗi (dùng cache logprob để chạy nhanh)."""
import glob, json, os, pickle, sys, collections
import numpy as np, soundfile as sf
from pron import Model, Thresholds, diagnose, sentence_phones
DIR = sys.argv[1] if len(sys.argv) > 1 else 'audio/synth'
S = json.load(open('sentences.json'))
cache = f'{DIR}/.lp.pkl'
if os.path.exists(cache): rows = pickle.load(open(cache, 'rb'))
else:
    m = Model(); rows = []
    for f in sorted(glob.glob(f'{DIR}/*.wav')):
        n = os.path.basename(f)[:-4].split('_')
        if not n[0].isdigit(): continue
        x, _ = sf.read(f, dtype='float32'); lp, col = m.logprobs(x)
        rows.append(dict(f=f, i=int(n[0]), kind=n[-1], lp=lp, col=col))
    pickle.dump(rows, open(cache, 'wb'))
th = Thresholds(**json.load(open('thresholds.json')))
fa = collections.Counter(); hit = collections.Counter(); miss = collections.Counter()
for r in rows:
    s = S[r['i']]
    errs = [e for w in diagnose(r['lp'], r['col'], s['text'], th) for e in w.errors]
    exp = {(w.lower(), a, b) for w, a, b in s['errors']}
    for e in errs:
        k = (e.word.lower(), e.expected, e.heard)
        if r['kind'] == 'ok' or k not in exp: fa[(e.expected, e.heard or '∅', e.word)] += 1
    if r['kind'] == 'bad':
        got = {(e.word.lower(), e.expected, e.heard) for e in errs}
        for k in exp: (hit if k in got else miss)[(k[1], k[2] or '∅', k[0])] += 1
print('BÁO NHẦM (âm, nghe thành, từ): số lần'); [print('  ', k, v) for k, v in fa.most_common(25)]
print('BỎ SÓT:'); [print('  ', k, v) for k, v in miss.most_common(25)]
