/**
 * Thu âm thanh micro dạng PCM 16kHz mono cho chấm phát âm (chạy song song với nhận giọng).
 * Âm thanh chỉ nằm trong bộ nhớ máy, không gửi đi đâu.
 */
const TARGET = 16000

export type Capture = { stop: () => Promise<Float32Array>; cancel: () => void }

export async function startCapture(): Promise<Capture> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
  const Ctx = window.AudioContext || (window as any).webkitAudioContext
  let ctx: AudioContext
  try { ctx = new Ctx({ sampleRate: TARGET }) } catch { ctx = new Ctx() }
  await ctx.resume().catch(() => {}) // iOS: AudioContext có thể bắt đầu ở trạng thái tạm dừng
  const src = ctx.createMediaStreamSource(stream)
  const proc = ctx.createScriptProcessor(4096, 1, 1)
  const chunks: Float32Array[] = []
  proc.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
  src.connect(proc)
  proc.connect(ctx.destination)
  const close = () => {
    proc.disconnect(); src.disconnect()
    stream.getTracks().forEach((t) => t.stop())
    void ctx.close().catch(() => {})
  }
  return {
    cancel: close,
    stop: async () => {
      close()
      const n = chunks.reduce((s, c) => s + c.length, 0)
      const all = new Float32Array(n)
      let o = 0
      for (const c of chunks) { all.set(c, o); o += c.length }
      return resample(all, ctx.sampleRate, TARGET)
    },
  }
}

/** Đổi tần số lấy mẫu (nội suy tuyến tính) — dùng khi trình duyệt không cho mở AudioContext 16kHz. */
export function resample(x: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return x
  const n = Math.round((x.length * to) / from)
  const y = new Float32Array(n)
  const r = from / to
  for (let i = 0; i < n; i++) {
    const p = i * r, i0 = Math.floor(p), f = p - i0
    y[i] = (x[i0] ?? 0) * (1 - f) + (x[i0 + 1] ?? x[i0] ?? 0) * f
  }
  return y
}

/** PCM → file WAV để học sinh nghe lại giọng mình. */
export function toWav(pcm: Float32Array, rate = TARGET): Blob {
  const buf = new ArrayBuffer(44 + pcm.length * 2)
  const v = new DataView(buf)
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, pcm.length * 2, true)
  for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true)
  return new Blob([buf], { type: 'audio/wav' })
}
