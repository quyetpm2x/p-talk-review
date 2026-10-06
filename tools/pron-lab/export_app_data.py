"""Xuất dữ liệu cho app: từ điển IPA (từ trong bài học), bộ âm, ngưỡng; và mẫu đối chiếu cho test TypeScript."""
import glob, json, os, pickle, re
import numpy as np
from pron import word_phones, EN_INV, Thresholds, diagnose, sentence_phones

OUT = '../../src/pron/data'; os.makedirs(OUT, exist_ok=True)
texts = []
def walk(x):
    if isinstance(x, str): texts.append(x)
    elif isinstance(x, list): [walk(i) for i in x]
    elif isinstance(x, dict): [walk(v) for v in x.values()]
for f in glob.glob('../../src/lessons/**/*.json', recursive=True):
    if '/ipa' not in f: walk(json.load(open(f)))
for s in json.load(open('sentences.json')): texts += [s['text']]
words = sorted({w.lower() for t in texts for w in re.findall(r"[A-Za-z']+", t) if re.search('[a-z]', w, re.I)})
ipa = {w: ' '.join(word_phones(w)) for w in words}
ipa = {w: p for w, p in ipa.items() if p}
json.dump(ipa, open(f'{OUT}/ipa.json', 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump(EN_INV, open(f'{OUT}/inventory.json', 'w'), ensure_ascii=False)
th = json.load(open('thresholds.json'))
json.dump(th, open(f'{OUT}/thresholds.json', 'w'), ensure_ascii=False, indent=2)
print('ipa words', len(ipa), 'inventory', len(EN_INV))

# Mẫu đối chiếu: vài file (đúng + sai), log-prob làm tròn 3 chữ số + kết quả Python
rows = pickle.load(open('audio/synth/.lp.pkl', 'rb'))
S = json.load(open('sentences.json'))
T = Thresholds(**th)
pick = [r for r in rows if r['who'] == '0' and r['i'] in (0, 3, 13, 14)]
fx = []
for r in pick:
    lp = np.round(r['lp'], 3)
    res = diagnose(lp, r['col'], S[r['i']]['text'], T)
    fx.append({'text': S[r['i']]['text'], 'kind': r['kind'], 'lp': lp.tolist(),
               'words': [{'word': w.word, 'level': w.level, 'errors': [{'expected': e.expected, 'heard': e.heard} for e in w.errors]} for w in res]})
os.makedirs('../../tests/fixtures', exist_ok=True)
json.dump(fx, open('../../tests/fixtures/pron.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('fixtures', len(fx), [(f['kind'], [(w['word'], w['level']) for w in f['words'] if w['level'] != 'Tốt']) for f in fx])
