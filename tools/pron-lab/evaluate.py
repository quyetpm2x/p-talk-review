"""
Đánh giá + hiệu chỉnh ngưỡng chấm phát âm.
  python evaluate.py                   → audio/synth: hiệu chỉnh trên giọng 0,1; kiểm tra trên giọng 2,3 (chưa thấy)
  python evaluate.py audio/real        → ghi âm thật (tên NN_<người>_ok.wav / NN_<người>_bad.wav), dùng ngưỡng đã lưu
  python evaluate.py audio/real --fit  → hiệu chỉnh lại ngưỡng trên ghi âm thật
Xuất report.html để nghe và xem từng câu.
"""
import glob, html, json, os, pickle, sys, time, collections
import numpy as np, soundfile as sf
from pron import Model, Thresholds, diagnose, greedy, ctc_loglik, sentence_phones, hypotheses, pair_key, VOCAB

args = [a for a in sys.argv[1:] if not a.startswith('--')]
DIR = args[0] if args else 'audio/synth'
FIT = '--fit' in sys.argv or DIR == 'audio/synth'
S = json.load(open('sentences.json'))

# ---------- 1) mô hình: chạy một lần, lưu cache ----------
cache = f'{DIR}/.lp.pkl'
files = sorted(f for f in glob.glob(f'{DIR}/*.wav') if os.path.basename(f)[:2].isdigit())
rows = pickle.load(open(cache, 'rb')) if os.path.exists(cache) else []
if len(rows) != len(files):
    m = Model(); rows = []; t0 = time.time(); sec = 0
    for f in files:
        x, sr = sf.read(f, dtype='float32')
        if x.ndim > 1: x = x.mean(1)
        assert sr == 16000, f'{f}: cần 16kHz mono'
        sec += len(x) / 16000
        n = os.path.basename(f)[:-4].split('_')
        lp, col = m.logprobs(x)
        rows.append(dict(f=f, i=int(n[0]), who=n[1], kind=n[-1], lp=lp, col=col))
    print(f'Mô hình: {sec:.0f}s audio trong {time.time()-t0:.1f}s (1 luồng CPU) → {sec/(time.time()-t0):.1f}× thời gian thực')
    pickle.dump(rows, open(cache, 'wb'))

# ---------- 2) LLR của mọi giả thuyết trên mọi file ----------
def all_llr(r):
    words = sentence_phones(S[r['i']]['text'])
    flat = [r['col'][VOCAB[p]] for _, ps in words for p in ps]
    base = ctc_loglik(r['lp'], flat)
    out = []
    for k, wi, p, alt in hypotheses(words):
        seq = flat[:k] + ([r['col'][VOCAB[alt]]] if alt else []) + flat[k + 1:]
        out.append((words[wi][0].lower(), p, alt, ctc_loglik(r['lp'], seq) - base))
    return out
for r in rows:
    r['llr'] = all_llr(r)

def labelled(sub):
    pos, neg = collections.defaultdict(list), collections.defaultdict(list)
    for r in sub:
        scripted = {(w.lower(), a, b) for w, a, b in S[r['i']]['errors']}
        for w, p, alt, v in r['llr']:
            key = pair_key(p, alt)
            if r['kind'] == 'bad' and (w, p, alt) in scripted: pos[key].append(v)
            elif r['kind'] == 'ok': neg[key].append(v)
    return pos, neg

# ---------- 3) hiệu chỉnh ngưỡng từng cặp ----------
FLOOR = 0.5  # phải có bằng chứng: câu-có-lỗi phải khớp hơn câu-chuẩn ít nhất e^0.5 lần

def fit(sub):
    pos, neg = labelled(sub)
    pairs = {}
    for key in set(pos) | set(neg):
        P, N = np.array(pos.get(key, [])), np.array(neg.get(key, []))
        if not len(P):
            pairs[key] = float(max(N.max() + 0.5, 2.0)) if len(N) else 2.0
            continue
        best = None
        for t in np.arange(FLOOR, 10.01, 0.25):
            tp = (P >= t).mean(); fp = (N >= t).mean() if len(N) else 0
            sc = tp - 4 * fp  # báo nhầm bị phạt nặng: thà bỏ sót còn hơn báo sai cho học sinh
            if best is None or sc > best[0] + 1e-9: best = (sc, t)
        pairs[key] = float(best[1])
    return Thresholds(default=2.0, pairs=pairs)

def measure(sub, th):
    hit = miss = fa_err = ok_n = 0
    per = collections.Counter()
    for r in sub:
        s = S[r['i']]
        errs = [e for w in diagnose(r['lp'], r['col'], s['text'], th) for e in w.errors]
        if r['kind'] == 'ok':
            ok_n += 1; fa_err += len(errs)
            for e in errs: per[(e.word, pair_key(e.expected, e.heard))] += 1
        else:
            got = {(e.word.lower(), e.expected, e.heard) for e in errs}
            for w, a, b in s['errors']:
                if (w.lower(), a, b) in got: hit += 1
                else: miss += 1
    return hit, miss, fa_err, ok_n, per

def show(label, hit, miss, fa_err, ok_n, per):
    print(f'\n[{label}]')
    print(f'  Đọc SAI : bắt đúng {hit}/{hit+miss} lỗi ({hit/max(1,hit+miss)*100:.0f}%)   — mục tiêu ≥ 80%')
    print(f'  Đọc ĐÚNG: báo nhầm {fa_err/max(1,ok_n)*10:.1f} lỗi/10 câu   — mục tiêu ≤ 1')
    if per: print('  Nhầm ở:', ', '.join(f'{w} {k}×{n}' for (w, k), n in per.most_common(8)))

whos = sorted({r['who'] for r in rows})
if FIT and len(whos) > 1:
    # Đánh giá chéo: lần lượt chừa 1 người/giọng ra, hiệu chỉnh trên số còn lại, đo trên người bị chừa
    tot = [0, 0, 0, 0]; per_all = collections.Counter()
    for w in whos:
        th_cv = fit([r for r in rows if r['who'] != w])
        h, m_, f, o, per = measure([r for r in rows if r['who'] == w], th_cv)
        tot = [tot[0] + h, tot[1] + m_, tot[2] + f, tot[3] + o]; per_all += per
    show(f'ĐÁNH GIÁ CHÉO — mỗi giọng được chấm bằng ngưỡng hiệu chỉnh từ {len(whos)-1} giọng khác', *tot, per_all)
if FIT:
    th = fit(rows)
    json.dump({'default': th.default, 'pairs': th.pairs, 'weak_margin': th.weak_margin}, open('thresholds.json', 'w'), indent=2, ensure_ascii=False)
    print('\nNgưỡng cuối (hiệu chỉnh trên toàn bộ):', ', '.join(f'{k} {v:.2f}' for k, v in sorted(th.pairs.items())))
else:
    th = Thresholds(**json.load(open('thresholds.json')))
show('TOÀN BỘ với ngưỡng cuối', *measure(rows, th))

# ---------- 5) report.html ----------
COLOR = {'Tốt': '#1f7a43', 'Khá': '#a8540c', 'Cần luyện': '#b8213f'}
out = ['<meta charset="utf-8"><title>Thử chấm phát âm</title><style>body{font:15px system-ui;max-width:900px;margin:24px auto;padding:0 16px}'
       '.c{border:1px solid #ddd;border-radius:10px;padding:10px 14px;margin:10px 0}.w{font-weight:700;margin-right:6px}.e{color:#b8213f}small{color:#666}</style>',
       f'<h1>Thử chấm phát âm — {html.escape(DIR)}</h1><p>Màu: <b style="color:#1f7a43">Tốt</b> · <b style="color:#a8540c">Khá</b> · <b style="color:#b8213f">Cần luyện</b></p>']
for r in rows:
    s = S[r['i']]
    wr = diagnose(r['lp'], r['col'], s['text'], th)
    words = ' '.join(f'<span class="w" style="color:{COLOR[w.level]}">{html.escape(w.word)}</span>' for w in wr)
    errs = ''.join(f'<li class="e">{html.escape(e.text)} <small>(độ chắc {e.llr})</small></li>' for w in wr for e in w.errors) or '<li><small>không có lỗi</small></li>'
    said = s['bad'] if r['kind'] == 'bad' else s['text']
    out.append(f'<div class="c"><b>{"❌ cố tình đọc sai" if r["kind"]=="bad" else "✅ đọc đúng"}</b> · <small>{html.escape(os.path.basename(r["f"]))} · đã đọc: “{html.escape(said)}”</small>'
               f'<div>{words}</div><ul>{errs}</ul><audio controls src="{html.escape(os.path.relpath(r["f"]))}"></audio>'
               f'<div><small>Mô hình nghe: {html.escape(greedy(r["lp"]))}</small></div></div>')
open('report.html', 'w').write('\n'.join(out))
print('→ report.html')
