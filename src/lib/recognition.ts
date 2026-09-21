/** Nhận diện giọng nói tiếng Anh (Web Speech API). */

type Ctor = new () => any
const getCtor = (): Ctor | undefined =>
  typeof window === 'undefined' ? undefined : (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition

export const hasRecognition = () => !!getCtor()

export type ListenError = 'unsupported' | 'denied' | 'no-speech' | 'network' | 'aborted'

/** Nghe một câu; promise trả về các phương án transcript (tốt nhất trước). */
export function listen(): { promise: Promise<string[]>; stop: () => void } {
  const C = getCtor()
  if (!C) return { promise: Promise.reject<string[]>('unsupported'), stop: () => {} }
  const rec = new C()
  rec.lang = 'en-US'
  rec.interimResults = false
  rec.maxAlternatives = 3
  rec.continuous = false
  const promise = new Promise<string[]>((resolve, reject) => {
    let got: string[] | null = null
    rec.onresult = (e: any) => {
      const r = e.results[0]
      got = Array.from({ length: r.length }, (_, i) => r[i].transcript as string)
    }
    rec.onerror = (e: any) => {
      const map: Record<string, ListenError> = {
        'not-allowed': 'denied', 'service-not-allowed': 'denied', 'no-speech': 'no-speech',
        network: 'network', aborted: 'aborted', 'audio-capture': 'denied',
      }
      reject(map[e.error] ?? 'network')
    }
    rec.onend = () => (got ? resolve(got) : reject('no-speech'))
  })
  promise.catch(() => {})
  try {
    rec.start()
  } catch {
    return { promise: Promise.reject<string[]>('aborted'), stop: () => {} }
  }
  return { promise, stop: () => rec.stop() }
}
