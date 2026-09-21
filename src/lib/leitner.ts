export type PhraseStat = { box: number; wrong: number; seen: number; last: number }

const DAY = 86400000
/** Số ngày chờ trước khi cụm ở box n đến hạn ôn lại. */
export const DUE_DAYS = [0, 0, 1, 2, 4, 7]

export function applyAnswer(s: PhraseStat | undefined, correct: boolean, now: number): PhraseStat {
  const cur = s ?? { box: 0, wrong: 0, seen: 0, last: 0 }
  return {
    box: correct ? Math.min(5, cur.box + 1) : 1,
    wrong: cur.wrong + (correct ? 0 : 1),
    seen: cur.seen + 1,
    last: now,
  }
}

export function isDue(s: PhraseStat | undefined, now: number): boolean {
  if (!s) return true
  return now - s.last >= DUE_DAYS[s.box] * DAY
}
