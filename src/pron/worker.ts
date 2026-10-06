/// <reference lib="webworker" />
/** Luồng nền chạy mô hình chấm phát âm (không làm đơ giao diện). */
import * as ort from 'onnxruntime-web/wasm'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import mjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url'
import { diagnose, englishLogprobs, VOCAB_SIZE } from './core'

ort.env.wasm.wasmPaths = { wasm: wasmUrl, mjs: mjsUrl }
ort.env.wasm.numThreads = 1 // WebView không có SharedArrayBuffer; 1 luồng như cấu hình gốc của bản int8

let session: ort.InferenceSession | null = null

type Src = { kind: 'cache'; cache: string; url: string } | { kind: 'url'; url: string }
type In = { id: number; type: 'init'; src: Src } | { id: number; type: 'run'; pcm: Float32Array; text: string }

self.onmessage = async (e: MessageEvent<In>) => {
  const m = e.data
  try {
    if (m.type === 'init') {
      const t0 = performance.now()
      const r = m.src.kind === 'cache' ? await (await caches.open(m.src.cache)).match(m.src.url) : await fetch(m.src.url)
      if (!r || !r.ok) throw new Error('Chưa tải mô hình')
      let bytes: Uint8Array | null = new Uint8Array(await r.arrayBuffer())
      session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
      bytes = null
      postMessage({ id: m.id, ok: true, ms: performance.now() - t0 })
      return
    }
    if (!session) throw new Error('Mô hình chưa sẵn sàng')
    const t0 = performance.now()
    const x = m.pcm
    let mean = 0
    for (let i = 0; i < x.length; i++) mean += x[i]
    mean /= x.length || 1
    let v = 0
    for (let i = 0; i < x.length; i++) v += (x[i] - mean) ** 2
    const sd = Math.sqrt(v / (x.length || 1)) + 1e-7
    const norm = new Float32Array(x.length)
    for (let i = 0; i < x.length; i++) norm[i] = (x[i] - mean) / sd
    const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', norm, [1, norm.length]) })
    const logits = out[session.outputNames[0]]
    const frames = logits.dims[1] as number
    const lp = englishLogprobs(logits.data as Float32Array, frames, VOCAB_SIZE)
    const words = diagnose(lp, m.text)
    postMessage({ id: m.id, ok: true, words, ms: performance.now() - t0, audioSec: x.length / 16000 })
  } catch (err) {
    postMessage({ id: m.id, ok: false, error: String((err as Error)?.message ?? err) })
  }
}
