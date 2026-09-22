/** Âm thanh hiệu ứng tạo bằng Web Audio (không cần file). */

const KEY = 'ptalk:sfx-muted'
let muted = (() => {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
})()
let ctx: AudioContext | undefined

export const isMuted = () => muted
export function setMuted(m: boolean) {
  muted = m
  try { localStorage.setItem(KEY, m ? '1' : '0') } catch { /* không lưu được */ }
}

function ac(): AudioContext | undefined {
  if (typeof window === 'undefined') return
  const C = window.AudioContext ?? (window as any).webkitAudioContext
  if (!C) return
  ctx ??= new C()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(freq: number, dur: number, { type = 'sine' as OscillatorType, vol = 0.2, slide = 0, delay = 0 } = {}) {
  const c = ac()
  if (!c) return
  const t = c.currentTime + delay
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur)
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  o.connect(g).connect(c.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function noise(dur: number, vol = 0.3, lowpass = 1200) {
  const c = ac()
  if (!c) return
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const s = c.createBufferSource()
  s.buffer = buf
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = lowpass
  const g = c.createGain()
  g.gain.value = vol
  s.connect(f).connect(g).connect(c.destination)
  s.start()
}

export type Sfx = 'pop' | 'ok' | 'bad' | 'whoosh' | 'boom' | 'tick' | 'go' | 'win' | 'lose' | 'slice' | 'boost'

export function sfx(name: Sfx) {
  if (muted) return
  switch (name) {
    case 'pop': noise(0.12, 0.35, 3000); tone(900, 0.08, { type: 'triangle', vol: 0.15, slide: -500 }); break
    case 'ok': tone(660, 0.1, { type: 'triangle' }); tone(990, 0.16, { type: 'triangle', delay: 0.08 }); break
    case 'bad': tone(220, 0.25, { type: 'sawtooth', vol: 0.12, slide: -90 }); break
    case 'whoosh': noise(0.25, 0.18, 900); break
    case 'slice': noise(0.1, 0.25, 5000); tone(1400, 0.08, { type: 'square', vol: 0.05, slide: -900 }); break
    case 'boom': noise(0.6, 0.6, 400); tone(90, 0.5, { type: 'sine', vol: 0.4, slide: -50 }); break
    case 'tick': tone(880, 0.07, { type: 'square', vol: 0.08 }); break
    case 'go': tone(1320, 0.3, { type: 'square', vol: 0.1 }); break
    case 'boost': tone(300, 0.35, { type: 'sawtooth', vol: 0.1, slide: 600 }); break
    case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'triangle', delay: i * 0.1 })); break
    case 'lose': [392, 330, 262].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.15, delay: i * 0.15 })); break
  }
}
