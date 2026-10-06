import { it, expect, vi, beforeEach, describe } from 'vitest'

const ev: Record<string, (e: any) => void> = {}
let status: any = null
let fileSize = 0
const DL = {
  addListener: vi.fn(async (n: string, f: any) => { ev[n] = f; return { remove: async () => {} } }),
  checkStatus: vi.fn(async () => { if (!status) throw new Error('Task not found'); return status }),
  download: vi.fn(async () => ({ id: 'x', progress: 0, state: 'RUNNING' })),
  resume: vi.fn(async () => {}),
  stop: vi.fn(async () => {}),
}
const FS = {
  stat: vi.fn(async () => { if (!fileSize) throw new Error('no file'); return { size: fileSize } }),
  mkdir: vi.fn(async () => {}),
  getUri: vi.fn(async ({ path }: any) => ({ uri: `file:///var/app/Library/NoCloud/${path}` })),
  deleteFile: vi.fn(async () => {}),
}
let plat: 'ios' | 'android' = 'ios'
vi.mock('@capgo/capacitor-downloader', () => ({ CapacitorDownloader: DL }))
vi.mock('@capacitor/filesystem', () => ({ Filesystem: FS, Directory: { External: 'EXTERNAL', LibraryNoCloud: 'LIBRARY_NO_CLOUD' } }))
vi.mock('../src/lib/platform', () => ({ isNative: () => true, platform: () => plat }))

const m = await import('../src/pron/model')
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }

beforeEach(async () => {
  localStorage.clear(); vi.clearAllMocks(); status = null; fileSize = 0; plat = 'ios'
  await m.deleteModel()
})

describe('tải nền bộ chấm phát âm (app)', () => {
  it('iOS: giao cho URLSession nền, lưu ở Library/NoCloud; tiến độ cập nhật kho dùng chung; xong → ready', async () => {
    await m.startDownload()
    expect(DL.download).toHaveBeenCalledWith(expect.objectContaining({ id: 'ptalk-pron-model', url: m.MODEL_URL, destination: 'file:///var/app/Library/NoCloud/models/wav2vec2_int8.onnx', notification: 'progress' }))
    ev.downloadProgress({ id: 'ptalk-pron-model', progress: 0.4, bytesWritten: 142_141_197, bytesTotal: m.MODEL_BYTES })
    expect(m.getDownloadState()).toEqual({ status: 'downloading', progress: expect.closeTo(0.4, 2) })
    fileSize = m.MODEL_BYTES
    ev.downloadCompleted({ id: 'ptalk-pron-model' }); await flush()
    expect(m.getDownloadState()).toEqual({ status: 'ready' })
    expect(localStorage.getItem('ptalk:pron-download')).toBeNull()
  })

  it('Android: đường dẫn tương đối (DownloadManager ghi vào external files của app)', async () => {
    plat = 'android'
    await m.startDownload()
    expect(DL.download).toHaveBeenCalledWith(expect.objectContaining({ destination: 'models/wav2vec2_int8.onnx' }))
  })

  it('mở lại app khi hệ điều hành vẫn đang tải dở → chỉ nghe tiến độ, không tạo lượt tải mới', async () => {
    localStorage.setItem('ptalk:pron-download', '1')
    status = { id: 'ptalk-pron-model', state: 'RUNNING', progress: 0.6 }
    await m.refreshDownload()
    expect(DL.download).not.toHaveBeenCalled()
    expect(m.getDownloadState().status).toBe('downloading')
  })

  it('lượt tải trước bị gián đoạn (app bị đóng hẳn) → tự tải lại khi mở app', async () => {
    localStorage.setItem('ptalk:pron-download', '1')
    await m.refreshDownload()
    expect(DL.download).toHaveBeenCalledTimes(1)
  })

  it('đang tạm dừng → nối tiếp; lỗi mạng → báo lỗi, bấm "Tải tiếp" chạy lại', async () => {
    status = { id: 'ptalk-pron-model', state: 'PAUSED', progress: 0.3 }
    await m.startDownload()
    expect(DL.resume).toHaveBeenCalled()
    ev.downloadFailed({ id: 'ptalk-pron-model', error: 'net' })
    expect(m.getDownloadState().status).toBe('error')
    status = null
    await m.startDownload()
    expect(DL.download).toHaveBeenCalledTimes(1)
  })

  it('đã có file đủ dung lượng → ready, không tải', async () => {
    fileSize = m.MODEL_BYTES
    await m.refreshDownload()
    expect(m.getDownloadState()).toEqual({ status: 'ready' })
    expect(DL.download).not.toHaveBeenCalled()
  })
})
