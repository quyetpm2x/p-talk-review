import { cleanPhrase, normalize } from './scoring'
import type { Rnd } from './shuffle'


/**
 * Tạo "bom" sai ngữ pháp từ một cụm đúng bằng cách đảo 2 từ liền nhau.
 * Ví dụ: "How have you been?" → "How you have been?". Cụm dưới 3 từ thì không tạo.
 */
export function makeBomb(en: string, rnd: Rnd = Math.random): string | undefined {
  const words = cleanPhrase(en).split(/\s+/).filter(Boolean)
  if (words.length < 3) return undefined
  const m = words[words.length - 1].match(/^(.*?)([.!?]*)$/)!
  const end = m[2]
  const base = [...words.slice(0, -1), m[1]]
  // Chữ đầu câu viết thường lại (trừ "I" và tên riêng giữa câu không đổi)
  const first = base[0]
  const lowerFirst = /^I('|$)/.test(first) ? first : first[0].toLowerCase() + first.slice(1)
  const plain = [lowerFirst, ...base.slice(1)]
  const orig = normalize(en).join(' ')
  // Không đảo 2 từ đầu: dễ thành câu hỏi đúng ngữ pháp ("Haven't you changed…")
  const starts = Array.from({ length: plain.length - 2 }, (_, i) => i + 1)
  // thử các vị trí theo thứ tự ngẫu nhiên
  for (let k = starts.length - 1; k > 0; k--) {
    const j = Math.floor(rnd() * (k + 1))
    ;[starts[k], starts[j]] = [starts[j], starts[k]]
  }
  for (const i of starts) {
    const w = plain.slice()
    ;[w[i], w[i + 1]] = [w[i + 1], w[i]]
    const s = w.join(' ')
    const out = s[0].toUpperCase() + s.slice(1) + end
    if (normalize(out).join(' ') !== orig) return out
  }
  return undefined
}

export type Pt = { x: number; y: number }
export type Box = { left: number; top: number; right: number; bottom: number }

const inside = (p: Pt, r: Box) => p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom

function segCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x))
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b)
}

/** Nhát chém (đoạn p1→p2) có đi qua hình chữ nhật không. */
export function segmentHitsRect(p1: Pt, p2: Pt, r: Box): boolean {
  if (inside(p1, r) || inside(p2, r)) return true
  const tl = { x: r.left, y: r.top }, tr = { x: r.right, y: r.top }
  const bl = { x: r.left, y: r.bottom }, br = { x: r.right, y: r.bottom }
  return segCross(p1, p2, tl, tr) || segCross(p1, p2, tr, br) || segCross(p1, p2, br, bl) || segCross(p1, p2, bl, tl)
}

/**
 * Số bước xe ma đã đi, chỉ phụ thuộc thời gian: bước đầu mất `firstStepMs`,
 * mỗi bước sau bằng bước trước × `accel` (< 1 là nhanh dần). Tối đa `track` bước.
 */
export function ghostSteps(elapsedMs: number, firstStepMs: number, track: number, accel = 1): number {
  let t = 0, step = firstStepMs
  for (let k = 0; k < track; k++) {
    t += step
    if (elapsedMs < t) return k
    step *= accel
  }
  return track
}

/** Thời điểm xe ma về đích (ms). */
export function ghostFinishMs(firstStepMs: number, track: number, accel = 1): number {
  let t = 0, step = firstStepMs
  for (let k = 0; k < track; k++) { t += step; step *= accel }
  return t
}

/** Hệ số tốc độ theo cấp độ: tăng 12% mỗi cấp, tối đa ×2.2. */
export const levelSpeed = (level: number) => Math.min(1 + level * 0.12, 2.2)
