/**
 * Chấm phát âm theo âm vị — bản TypeScript của tools/pron-lab/pron.py (phải cho kết quả giống hệt; xem tests/pron.test.ts).
 *
 * Mô hình wav2vec2 (Meta, bản int8) cho xác suất từng âm IPA theo khung 20ms. Thay vì hỏi "đây là âm gì",
 * ta hỏi câu hẹp: audio khớp câu chuẩn hơn hay khớp câu có lỗi X hơn (θ→t, mất /k/ cuối…)?
 * LLR = logP(câu có lỗi) − logP(câu chuẩn) theo CTC. LLR ≥ ngưỡng của cặp lỗi → báo lỗi.
 */
import IPA from './data/ipa.json'
import INVENTORY from './data/inventory.json'
import THRESHOLDS from './data/thresholds.json'

/** Bộ âm tiếng Anh: cột 0 = blank (<pad>, id 0), cột k = INVENTORY[k-1]. */
export const INV = (INVENTORY as [string, number][]).map(([p]) => p)
export const MODEL_IDS = [0, ...(INVENTORY as [string, number][]).map(([, id]) => id)]
const COL = new Map(INV.map((p, i) => [p, i + 1]))
export const VOCAB_SIZE = 392

/** Lấy các lớp tiếng Anh + blank từ đầu ra mô hình (frames × 392) rồi log-softmax lại. Trả mảng frames × K. */
export function englishLogprobs(logits: Float32Array, frames: number, vocab = VOCAB_SIZE): Float64Array[] {
  const K = MODEL_IDS.length
  const out: Float64Array[] = []
  for (let t = 0; t < frames; t++) {
    const row = new Float64Array(K)
    let mx = -Infinity
    for (let k = 0; k < K; k++) { row[k] = logits[t * vocab + MODEL_IDS[k]]; if (row[k] > mx) mx = row[k] }
    let sum = 0
    for (let k = 0; k < K; k++) sum += Math.exp(row[k] - mx)
    const lse = mx + Math.log(sum)
    for (let k = 0; k < K; k++) row[k] -= lse
    out.push(row)
  }
  return out
}

const logaddexp = (a: number, b: number) => {
  if (a === -Infinity) return b
  if (b === -Infinity) return a
  const m = Math.max(a, b)
  return m + Math.log1p(Math.exp(-Math.abs(a - b)))
}

/** log P(labels | audio) theo CTC (forward). labels: chỉ số cột (không có blank). */
export function ctcLoglik(lp: ArrayLike<number>[], labels: number[]): number {
  const T = lp.length
  if (T < labels.length) return -1e9
  const ext: number[] = [0]
  for (const l of labels) ext.push(l, 0)
  const S = ext.length
  const NEG = -1e30
  let a = new Float64Array(S).fill(NEG)
  a[0] = lp[0][ext[0]]
  if (S > 1) a[1] = lp[0][ext[1]]
  for (let t = 1; t < T; t++) {
    const prev = a
    a = new Float64Array(S).fill(NEG)
    a[0] = prev[0] + lp[t][0]
    for (let s = 1; s < S; s++) {
      let v = logaddexp(prev[s], prev[s - 1])
      if (s > 1 && ext[s] !== 0 && ext[s] !== ext[s - 2]) v = logaddexp(v, prev[s - 2])
      a[s] = v + lp[t][ext[s]]
    }
  }
  return S > 1 ? logaddexp(a[S - 1], a[S - 2]) : a[S - 1]
}

// ---------- Lỗi điển hình của người Việt (giống pron.py) ----------
type Where = 'any' | 'initial' | 'final' | 'nonfinal'
export const PAIRS: [string, string, Where][] = [
  ['θ', 't', 'any'], ['ð', 'd', 'any'], ['ʃ', 's', 'any'], ['ʒ', 'z', 'any'],
  ['z', 's', 'nonfinal'], ['v', 'b', 'any'], ['ŋ', 'n', 'final'], ['ɹ', 'l', 'initial'],
]
const FINAL_DROP = new Set(['k', 't', 'd', 's', 'z'])
const FUNCTION_WORDS = new Set(`a an the is it it's its what that this these those have has had haven't hasn't don't doesn't didn't
can't won't isn't aren't wasn't weren't and of to at in on but just must not could would should and or if as
was were be been are am i'm you're we're they're he's she's that's what's how's there's let's i've you've
we've i'd you'd i'll you'll get got`.split(/\s+/))

export const pairKey = (exp: string, heard: string) => `${exp}>${heard || '∅'}`
const posOk = (w: Where, pi: number, n: number) =>
  w === 'any' || (w === 'initial' && pi === 0) || (w === 'final' && pi === n - 1) || (w === 'nonfinal' && pi < n - 1)

export type Thresholds = { default: number; pairs: Record<string, number>; weak_margin: number }
export const DEFAULT_THRESHOLDS = THRESHOLDS as Thresholds

const ipa = IPA as Record<string, string>
export const wordsOf = (text: string) => text.match(/[A-Za-z']+/g) ?? []
export const normWord = (w: string) => w.toLowerCase().replace(/’/g, "'")
/** IPA của một từ (từ điển sinh sẵn bằng eSpeak NG); không có → undefined. */
export const phonesOf = (w: string): string[] | undefined => ipa[normWord(w)]?.split(' ').filter((p) => COL.has(p))

export type PronError = { expected: string; heard: string; llr: number }
export type WordResult = { word: string; phones: string[]; known: boolean; level: 'Tốt' | 'Khá' | 'Cần luyện'; errors: PronError[] }

/**
 * Chẩn đoán một câu. Từ không có trong từ điển được bỏ khỏi chuỗi âm (chỉ chấm các từ đã biết) và luôn ở mức 'Tốt'.
 * @param lp log-prob tiếng Anh (frames × K), cột 0 = blank
 */
export function diagnose(lp: ArrayLike<number>[], text: string, th: Thresholds = DEFAULT_THRESHOLDS): WordResult[] {
  const words = wordsOf(text).map((w) => ({ word: w, phones: phonesOf(w) }))
  const flat: number[] = []
  const hyps: { k: number; wi: number; p: string; alt: string }[] = []
  words.forEach(({ word, phones }, wi) => {
    if (!phones?.length) return
    phones.forEach((p, pi) => {
      const k = flat.length
      for (const [exp, alt, where] of PAIRS) if (p === exp && posOk(where, pi, phones.length) && COL.has(alt)) hyps.push({ k, wi, p, alt })
      if (pi === phones.length - 1 && FINAL_DROP.has(p) && phones.length > 1 && !FUNCTION_WORDS.has(normWord(word))) hyps.push({ k, wi, p, alt: '' })
      flat.push(COL.get(p)!)
    })
  })
  const results: WordResult[] = words.map(({ word, phones }) => ({ word, phones: phones ?? [], known: !!phones?.length, level: 'Tốt', errors: [] }))
  if (!flat.length || !lp.length) return results
  const base = ctcLoglik(lp, flat)
  const weak = new Set<number>()
  for (const h of hyps) {
    const seq = [...flat.slice(0, h.k), ...(h.alt ? [COL.get(h.alt)!] : []), ...flat.slice(h.k + 1)]
    const llr = ctcLoglik(lp, seq) - base
    const t = th.pairs[pairKey(h.p, h.alt)] ?? th.default
    if (llr >= t) results[h.wi].errors.push({ expected: h.p, heard: h.alt, llr: Math.round(llr * 100) / 100 })
    else if (llr >= t - th.weak_margin) weak.add(h.wi)
  }
  results.forEach((r, wi) => {
    if (r.errors.length) {
      r.level = 'Cần luyện'
      const best = new Map<string, PronError>()
      for (const e of [...r.errors].sort((a, b) => b.llr - a.llr)) if (!best.has(e.expected)) best.set(e.expected, e)
      r.errors = [...best.values()]
    } else if (weak.has(wi)) r.level = 'Khá'
  })
  return results
}

/** Câu mô tả lỗi cho học sinh, đúng định dạng đã chốt. */
export const errorText = (word: string, e: PronError) =>
  e.heard ? `âm /${e.expected}/ trong ${word} bị đọc thành /${e.heard}/` : `mất âm /${e.expected}/ cuối ${word}`

/** Mức chung của câu: có từ "Cần luyện" → Cần luyện; có "Khá" → Khá; còn lại Tốt. */
export const sentenceLevel = (r: WordResult[]): WordResult['level'] =>
  r.some((w) => w.level === 'Cần luyện') ? 'Cần luyện' : r.some((w) => w.level === 'Khá') ? 'Khá' : 'Tốt'
