/**
 * Tạo file MP3 giọng đọc cho mọi câu có nút nghe trong các bài học.
 *
 *   cd tools/tts && npm install      # lần đầu
 *   npm run tts                      # từ thư mục gốc dự án
 *
 * Câu nào đã có file thì bỏ qua. Cần ffmpeg (brew install ffmpeg).
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { KokoroTTS } from 'kokoro-js'
import { clipKey, collectClips, ttsInput, type Clip } from '../../src/lib/audioKey'
import type { Lesson } from '../../src/types'

const ROOT = resolve(import.meta.dirname, '../..')
const LESSONS = join(ROOT, 'src/lessons')
const OUT = join(ROOT, 'public/audio')
const MANIFEST = join(ROOT, 'src/audio/manifest.json')
const BITRATE = '48k'

const fileFor = (key: string) => createHash('sha1').update(key).digest('hex').slice(0, 12) + '.mp3'

const lessons: Lesson[] = readdirSync(LESSONS)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(LESSONS, f), 'utf8')))

const clips = new Map<string, Clip>()
for (const l of lessons) for (const c of collectClips(l)) clips.set(clipKey(c.text, c.voice), c)

mkdirSync(OUT, { recursive: true })
const manifest: Record<string, string> = {}
const todo: [string, Clip][] = []
for (const [key, c] of clips) {
  manifest[key] = fileFor(key)
  if (!existsSync(join(OUT, manifest[key]))) todo.push([key, c])
}
console.log(`${clips.size} câu, cần tạo mới ${todo.length}`)

if (todo.length) {
  const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' })
  const tmp = join(tmpdir(), `ptalk-tts-${process.pid}.wav`)
  let n = 0
  for (const [key, c] of todo) {
    const audio = await tts.generate(ttsInput(c.text), { voice: c.voice as any })
    await audio.save(tmp)
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', tmp, '-ac', '1', '-c:a', 'libmp3lame', '-b:a', BITRATE, join(OUT, manifest[key])])
    console.log(`[${++n}/${todo.length}] ${c.voice}  ${c.text}`)
  }
  rmSync(tmp, { force: true })
}

// Xoá file cũ không còn dùng
const used = new Set(Object.values(manifest))
for (const f of readdirSync(OUT)) if (f.endsWith('.mp3') && !used.has(f)) rmSync(join(OUT, f))

const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync(MANIFEST, JSON.stringify(sorted, null, 2) + '\n')
console.log(`Đã ghi ${Object.keys(sorted).length} mục vào src/audio/manifest.json`)
