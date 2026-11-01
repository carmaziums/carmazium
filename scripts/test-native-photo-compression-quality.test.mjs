import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../carmazium app/carmazium app/src/lib/storageHelper.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText

function harness(sizes, width=4000, height=3000) {
  const calls = []
  const manipulator = {
    SaveFormat: { JPEG: 'jpeg' },
    manipulateAsync: async (uri, actions, options) => {
      calls.push({ uri, actions, options })
      const count=calls.length
      const resized=actions[0]?.resize
      return { uri: 'converted-' + count, width: resized?.width ?? width, height: resized?.height ?? height }
    },
  }
  const fs = {
    getInfoAsync: async uri => {
      const count=Number(uri.replace('converted-', ''))
      return { exists:true, size:sizes[Math.min(count-1,sizes.length-1)] }
    },
  }
  const mod = {exports:{}}
  const require = id => {
    if (id === 'expo-image-manipulator') return manipulator
    if (id === 'expo-file-system/legacy') return fs
    if (id === 'base64-arraybuffer') return {decode() {}}
    if (id === './supabase') return {supabase:{}}
    throw new Error('Unexpected import ' + id)
  }
  vm.runInNewContext(compiled, {module:mod,exports:mod.exports,require,console})
  return {compress:mod.exports.convertAndCompress, calls}
}

test('native photos return high-quality original-size JPEG when already within 2MB', async () => {
  const h=harness([500_000])
  assert.equal(await h.compress('file://source.heic'),'converted-1')
  assert.equal(h.calls.length,1)
  assert.equal(h.calls[0].options.compress,0.86)
  assert.equal(h.calls[0].options.format,'jpeg')
})

test('oversized photo retries original URI and resizes to preserve aspect ratio', async () => {
  const h=harness([4_000_000,3_000_000,2_600_000,1_800_000])
  assert.equal(await h.compress('file://source.png'),'converted-4')
  assert.equal(h.calls.length,4)
  for (const call of h.calls) assert.equal(call.uri,'file://source.png')
  assert.equal(h.calls[3].actions[0].resize.width,1920)
  assert.equal(h.calls[3].actions[0].resize.height,1440)
  for (const call of h.calls) assert.ok(call.options.compress >= 0.72)
})

test('never silently uploads zero-byte or oversized converted image', async () => {
  const zero=harness([0])
  await assert.rejects(zero.compress('file://zero.png'), /below 2 MB/)
  const huge=harness([8_000_000])
  await assert.rejects(huge.compress('file://too-big.png'), /below 2 MB/)
  assert.ok(huge.calls.length <= 16)
})

test('missing dimensions are reported rather than uploading unverified output', async () => {
  const h=harness([5_000_000],0,0)
  await assert.rejects(h.compress('file://broken.heic'), /photo.*dimensions/)
})

test('native upload retains Supabase signed upload and read-only QA boundaries', () => {
  assert.match(source,/EXPO_PUBLIC_QA_READ_ONLY === '1'/)
  assert.match(source,/uploadToSignedUrl/)
  assert.match(source,/upsert: false/)
  assert.match(source,/MAX_BYTES = 2 \* 1024 \* 1024/)
  assert.match(source,/MAX_IMAGE_EDGE = 1920/)
  assert.match(source,/MIN_JPEG_QUALITY = 0.72/)
})
