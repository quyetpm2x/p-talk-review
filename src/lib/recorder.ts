import { useCallback, useEffect, useRef, useState } from 'react'

export type RecState = 'idle' | 'recording' | 'ready' | 'unsupported' | 'denied'

const supported = () => typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia

/** Ghi âm tạm trong bộ nhớ; bản ghi mất khi rời trang. */
export function useRecorder() {
  const [state, setState] = useState<RecState>(supported() ? 'idle' : 'unsupported')
  const [url, setUrl] = useState<string>()
  const rec = useRef<MediaRecorder | null>(null)
  const urlRef = useRef<string>()

  const clear = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = undefined
    setUrl(undefined)
  }

  const start = useCallback(async () => {
    if (!supported()) return setState('unsupported')
    clear()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      const chunks: Blob[] = []
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const u = URL.createObjectURL(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }))
        urlRef.current = u
        setUrl(u)
        setState('ready')
      }
      rec.current = mr
      mr.start()
      setState('recording')
    } catch {
      setState('denied')
    }
  }, [])

  const stop = useCallback(() => {
    if (rec.current?.state === 'recording') rec.current.stop()
  }, [])

  const reset = useCallback(() => {
    clear()
    setState(supported() ? 'idle' : 'unsupported')
  }, [])

  useEffect(() => () => {
    if (rec.current?.state === 'recording') rec.current.stop()
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  return { state, url, start, stop, reset }
}
