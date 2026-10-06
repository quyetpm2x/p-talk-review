/** Điều phối chấm phát âm: nạp mô hình vào luồng nền một lần, rồi chấm từng câu. */
import type { WordResult } from './core'
import { modelSource } from './model'

let worker: Worker | null = null
let ready: Promise<void> | null = null
let seq = 0
const waiting = new Map<number, (r: any) => void>()

function call(msg: any, transfer: Transferable[] = []): Promise<any> {
  const id = ++seq
  return new Promise((resolve, reject) => {
    waiting.set(id, (r) => (r.ok ? resolve(r) : reject(new Error(r.error))))
    worker!.postMessage({ ...msg, id }, transfer)
  })
}

/** Nạp mô hình (đã tải) vào luồng nền. Gọi nhiều lần chỉ nạp một lần. */
export function loadEngine(): Promise<void> {
  if (ready) return ready
  ready = (async () => {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => { waiting.get(e.data.id)?.(e.data); waiting.delete(e.data.id) }
    await call({ type: 'init', src: await modelSource() })
  })().catch((e) => { ready = null; worker?.terminate(); worker = null; throw e })
  return ready
}

export type PronResult = { words: WordResult[]; ms: number; audioSec: number }

/** Chấm một câu: âm thanh 16kHz mono + câu học sinh định nói. */
export async function analyze(pcm: Float32Array, text: string): Promise<PronResult> {
  await loadEngine()
  const copy = pcm.slice()
  return call({ type: 'run', pcm: copy, text }, [copy.buffer])
}

export function unloadEngine() {
  worker?.terminate(); worker = null; ready = null; waiting.clear()
}
