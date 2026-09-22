import { listen, type ListenError } from '../../lib/recognition'

/**
 * listen() có "cầu chì": một số trình duyệt (vd. không có micro) bắt đầu nghe nhưng
 * không bao giờ báo kết thúc → tự dừng sau `ms`, và khi bấm dừng mà trình duyệt
 * không phản hồi thì cũng tự thoát sau 1.2 giây.
 */
export function listenSafe(ms = 10000): { promise: Promise<string[]>; stop: () => void } {
  const inner = listen()
  let reject: (e: ListenError) => void = () => {}
  let timer = 0
  const promise = new Promise<string[]>((res, rej) => {
    reject = rej
    timer = window.setTimeout(() => { inner.stop(); window.setTimeout(() => rej('no-speech'), 1200) }, ms)
    inner.promise.then(res, rej)
  })
  promise.catch(() => {}).finally(() => clearTimeout(timer))
  return {
    promise,
    stop: () => { inner.stop(); window.setTimeout(() => reject('aborted'), 1200) },
  }
}
