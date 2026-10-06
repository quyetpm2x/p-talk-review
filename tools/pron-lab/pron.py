"""
Chấm phát âm theo âm vị — bản thử (P0). Sẽ được viết lại bằng TypeScript cho app (P3).

Ý tưởng: không hỏi mô hình "đây là âm gì" (dễ sai), mà hỏi câu hẹp:
  "đoạn audio này khớp với câu chuẩn hơn, hay khớp với câu có lỗi X hơn?"
Mỗi giả thuyết lỗi (θ→t, mất /k/ cuối…) được chấm bằng CTC log-likelihood trên đầu ra của mô hình.
LLR = loglik(câu có lỗi) − loglik(câu chuẩn). LLR lớn → học sinh đã đọc theo kiểu lỗi đó.
"""
from __future__ import annotations
import json, re
from dataclasses import dataclass, field
from functools import lru_cache
import numpy as np

import espeakng_loader
from phonemizer.backend.espeak.wrapper import EspeakWrapper
EspeakWrapper.set_library(espeakng_loader.get_library_path())
EspeakWrapper.set_data_path(espeakng_loader.get_data_path())
from phonemizer.backend import EspeakBackend
from phonemizer.separator import Separator

MODEL_DIR = __file__.rsplit('/', 1)[0] + '/model'
VOCAB: dict[str, int] = json.load(open(f'{MODEL_DIR}/vocab.json'))
INV = {i: s for s, i in VOCAB.items()}
PAD = VOCAB['<pad>']

_backend = EspeakBackend('en-us', preserve_punctuation=False, with_stress=False)
_sep = Separator(phone=' ', word=' | ', syllable='')

# ---------- Âm vị câu mẫu ----------
def words_of(text: str) -> list[str]:
    return re.findall(r"[A-Za-z']+", text)

@lru_cache(maxsize=4096)
def word_phones(word: str) -> tuple[str, ...]:
    """IPA của một từ theo eSpeak NG (cùng bộ ký hiệu với mô hình). Tách ký hiệu lạ thành ký hiệu có trong vocab."""
    raw = _backend.phonemize([word.lower()], separator=_sep, strip=True)[0]
    out: list[str] = []
    for p in raw.replace('|', ' ').split():
        if p in VOCAB:
            out.append(p)
        else:  # vd. 'ɑːɹ' không có → thử tách dần từ trái
            i = 0
            while i < len(p):
                for j in range(len(p), i, -1):
                    if p[i:j] in VOCAB:
                        out.append(p[i:j]); i = j; break
                else:
                    i += 1
    return tuple(out)

def sentence_phones(text: str) -> list[tuple[str, list[str]]]:
    return [(w, list(word_phones(w))) for w in words_of(text)]

# ---------- Bộ âm tiếng Anh (chặn ký hiệu tiếng khác như 'ou5') ----------
_EN_SEED = ("the quick brown fox jumps over a lazy dog she sells sea shells think this that thing measure vision "
            "judge church yes year water better bird hurt north start square near cure about happy ago boy toy "
            "cat bed sit seat put food cup car law hot go now my day ring sing hang king long red right very wine "
            "zoo is was has cars bus bag dog big pig fish ship cheap jump lamp milk hello world nothing everything "
            "family stressful imagine believe recognize changed treating yourself happen fault could would")
import os as _os
_INV_FILE = __file__.rsplit('/', 1)[0] + '/en_inventory.json'
# Bộ âm tiếng Anh: sinh từ toàn bộ nội dung bài học + từ phổ biến (xem lệnh tạo trong README). App dùng lại đúng file này.
EN_INV = json.load(open(_INV_FILE)) if _os.path.exists(_INV_FILE) else \
    sorted({p for w in _EN_SEED.split() for p in word_phones(w)} | {'t', 'd', 's', 'z', 'n', 'b', 'f', 'p', 'l'})
EN_IDS = np.array([PAD] + [VOCAB[p] for p in EN_INV])

def english_logprobs(logits: np.ndarray) -> tuple[np.ndarray, dict[int, int]]:
    """Chỉ giữ các lớp tiếng Anh + blank, chuẩn hoá lại (log-softmax). Trả ma trận (frames × K) và map id gốc → cột."""
    sub = logits[:, EN_IDS]
    sub = sub - sub.max(-1, keepdims=True)
    lp = sub - np.log(np.exp(sub).sum(-1, keepdims=True))
    return lp, {int(t): k for k, t in enumerate(EN_IDS)}

# ---------- CTC log-likelihood (forward) ----------
def ctc_loglik(lp: np.ndarray, labels: list[int]) -> float:
    """log P(labels | audio) theo CTC; lp: (T × K) log-prob, labels: chỉ số cột (không có blank). Blank = cột 0."""
    T = lp.shape[0]
    ext = [0]
    for l in labels:
        ext += [l, 0]
    S = len(ext)
    if T < len(labels):
        return -1e9
    NEG = -1e30
    a = np.full(S, NEG)
    a[0] = lp[0, ext[0]]
    if S > 1:
        a[1] = lp[0, ext[1]]
    for t in range(1, T):
        prev = a
        a = np.full(S, NEG)
        a[0] = prev[0] + lp[t, 0]
        for s in range(1, S):
            v = np.logaddexp(prev[s], prev[s - 1])
            if s > 1 and ext[s] != 0 and ext[s] != ext[s - 2]:
                v = np.logaddexp(v, prev[s - 2])
            a[s] = v + lp[t, ext[s]]
    return float(np.logaddexp(a[-1], a[-2]) if S > 1 else a[-1])

# ---------- Lỗi điển hình của người Việt ----------
# (âm chuẩn, đọc thành, vị trí trong từ): 'any' | 'initial' | 'final' | 'nonfinal'
PAIRS: list[tuple[str, str, str]] = [
    ('θ', 't', 'any'), ('ð', 'd', 'any'), ('ʃ', 's', 'any'), ('ʒ', 'z', 'any'),
    ('z', 's', 'nonfinal'),     # z cuối từ người bản xứ cũng hay đọc nhẹ thành s → không bắt
    ('v', 'b', 'any'), ('ŋ', 'n', 'final'),  # ŋ trước k (think, thank) nghe gần n do nối âm → chỉ bắt cuối từ
    ('ɹ', 'l', 'initial'),
]
FINAL_DROP = {'k', 't', 'd', 's', 'z'}
# Từ chức năng: người bản xứ vốn nuốt âm cuối (wha(t) a, it'(s), haven'(t)) → không bắt "mất âm cuối"
FUNCTION_WORDS = set("""a an the is it it's its what that this these those have has had haven't hasn't don't doesn't didn't
can't won't isn't aren't wasn't weren't and of to at in on but just must not could would should and or if as
was were be been are am i'm you're we're they're he's she's that's what's how's there's let's i've you've
we've i'd you'd i'll you'll get got""".split())

def pair_key(exp: str, heard: str) -> str:
    return f"{exp}>{heard or '∅'}"

def _pos_ok(where: str, pi: int, n: int) -> bool:
    return where == 'any' or (where == 'initial' and pi == 0) or (where == 'final' and pi == n - 1) \
        or (where == 'nonfinal' and pi < n - 1)

@dataclass
class Err:
    word: str
    expected: str
    heard: str          # '' = mất âm
    llr: float          # càng lớn càng chắc
    @property
    def text(self) -> str:
        if self.heard:
            return f"âm /{self.expected}/ trong *{self.word}* bị đọc thành /{self.heard}/"
        return f"mất âm /{self.expected}/ cuối *{self.word}*"

@dataclass
class WordResult:
    word: str
    phones: list[str]
    level: str = 'Tốt'   # Tốt / Khá / Cần luyện
    errors: list[Err] = field(default_factory=list)

@dataclass
class Thresholds:
    default: float = 1.5                         # ngưỡng chung cho cặp chưa hiệu chỉnh
    pairs: dict[str, float] = field(default_factory=dict)  # vd. {"θ>t": 1.0, "d>∅": 2.0}
    weak_margin: float = 1.5                     # LLR ≥ ngưỡng − margin → mức "Khá"
    def of(self, exp: str, heard: str) -> float:
        return self.pairs.get(pair_key(exp, heard), self.default)

def hypotheses(words: list[tuple[str, list[str]]]):
    """Sinh các giả thuyết lỗi hợp lệ: (vị trí âm trong chuỗi phẳng, chỉ số từ, âm chuẩn, âm thay/'' )."""
    k = 0
    for wi, (w, ps) in enumerate(words):
        for pi, p in enumerate(ps):
            for exp, alt, where in PAIRS:
                if p == exp and _pos_ok(where, pi, len(ps)) and alt in VOCAB:
                    yield k, wi, p, alt
            if pi == len(ps) - 1 and p in FINAL_DROP and len(ps) > 1 and w.lower() not in FUNCTION_WORDS:
                yield k, wi, p, ''
            k += 1

def diagnose(lp: np.ndarray, col: dict[int, int], text: str, th: Thresholds = Thresholds()) -> list[WordResult]:
    words = sentence_phones(text)
    flat = [col[VOCAB[p]] for _, ps in words for p in ps]
    base = ctc_loglik(lp, flat)
    results = [WordResult(w, ps) for w, ps in words]
    weak: set[int] = set()
    for k, wi, p, alt in hypotheses(words):
        if alt and VOCAB[alt] not in col:
            continue
        seq = flat[:k] + ([col[VOCAB[alt]]] if alt else []) + flat[k + 1:]
        llr = ctc_loglik(lp, seq) - base
        t = th.of(p, alt)
        if llr >= t:
            results[wi].errors.append(Err(words[wi][0], p, alt, round(llr, 2)))
        elif llr >= t - th.weak_margin:
            weak.add(wi)
    for wi, r in enumerate(results):
        if r.errors:
            r.level = 'Cần luyện'
            seen: dict[str, Err] = {}
            for e in sorted(r.errors, key=lambda e: -e.llr):
                seen.setdefault(e.expected, e)
            r.errors = list(seen.values())
        elif wi in weak:
            r.level = 'Khá'
    return results

# ---------- Mô hình ----------
class Model:
    def __init__(self, path: str = f'{MODEL_DIR}/wav2vec2_int8.onnx'):
        import onnxruntime as ort
        so = ort.SessionOptions(); so.intra_op_num_threads = 1  # như cấu hình Sonari, gần với điện thoại
        self.sess = ort.InferenceSession(path, so, providers=['CPUExecutionProvider'])
        self.inp = self.sess.get_inputs()[0].name

    def logprobs(self, wav16k: np.ndarray):
        x = wav16k.astype(np.float32)
        x = (x - x.mean()) / (x.std() + 1e-7)
        logits = self.sess.run(None, {self.inp: x[None, :]})[0][0]
        return english_logprobs(logits)

def greedy(lp: np.ndarray) -> str:
    cols = [int(t) for t in EN_IDS]
    out, prev = [], -1
    for i in lp.argmax(-1):
        if i != prev and i != 0:
            out.append(INV[cols[i]])
        prev = i
    return ' '.join(out)
