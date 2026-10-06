/**
 * Đo âm lượng micro (0–1) cho sóng âm khi đang nghe — bản WEB (Web Audio AnalyserNode).
 * App iOS/Android dùng sự kiện `audioLevel` của plugin nhận giọng (xem recognition.ts).
 */
export function startMeter(onLevel: (v: number) => void): () => void {
  let stopped = false
  let cleanup = () => {}
  ;(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (stopped) { stream.getTracks().forEach((t) => t.stop()); return }
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      const ctx: AudioContext = new Ctx()
      const an = ctx.createAnalyser()
      an.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(an)
      const buf = new Float32Array(an.fftSize)
      let raf = 0
      const tick = () => {
        an.getFloatTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
        onLevel(levelFromRms(Math.sqrt(sum / buf.length)))
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      cleanup = () => { cancelAnimationFrame(raf); stream.getTracks().forEach((t) => t.stop()); void ctx.close().catch(() => {}) }
    } catch { /* không có quyền micro: bỏ qua sóng âm */ }
  })()
  return () => { stopped = true; cleanup() }
}

/** RMS (0–~0,5) → mức 0–1 dễ nhìn (thang log, lọc tiếng ồn nền). */
export const levelFromRms = (rms: number) => Math.max(0, Math.min(1, (20 * Math.log10(rms + 1e-6) + 55) / 40))
