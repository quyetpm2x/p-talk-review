export type Rnd = () => number

export function shuffle<T>(a: readonly T[], rnd: Rnd = Math.random): T[] {
  const b = a.slice()
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

export const sample = <T,>(a: readonly T[], n: number, rnd: Rnd = Math.random): T[] => shuffle(a, rnd).slice(0, n)
