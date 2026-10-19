import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Transpile the self-contained TS utility for real behavioural unit tests.
// Works with the Node version installed by the project's existing CI.
const source = readFileSync(new URL('../src/lib/damageMarkers.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText
const { buildBuyerDamagePins } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))

test('seller-tapped coordinates are retained exactly and numbered with their matching reports', () => {
  const pins = buildBuyerDamagePins([
    { id: 'a', part: 'boot', type: 'DENT - Small dent', imageUrl: 'https://example.test/damage.jpg',
      coords: { surfacePoint: { fx: 0.51, fy: 0.42, fz: 0.09 } } },
  ])
  assert.deepEqual(pins, [{
    id: 'a', number: 1, zone: 'boot',
    point: { fx: 0.51, fy: 0.42, fz: 0.09 },
    type: 'DENT', hasPhoto: true, approximate: false,
  }])
})

test('legacy Boot records become TWO numbered approximate rear markers rather than vanishing', () => {
  const pins = buildBuyerDamagePins([
    { id: 'boot-a', part: 'Boot', type: 'OTHER - Change boot and back bumper' },
    { id: 'boot-b', part: 'Boot', type: 'OTHER - Original replacement parts' },
  ])
  assert.equal(pins.length, 2)
  assert.deepEqual(pins.map(p => p.number), [1, 2])
  assert.deepEqual(pins.map(p => p.id), ['boot-a', 'boot-b'])
  assert.ok(pins.every(p => p.approximate && p.zone === 'Boot' && p.point.fz < 0.4))
})

test('recognized manually chosen areas get an approximate zone marker, not an exact claim', () => {
  const pins = buildBuyerDamagePins([
    { id: 'x', part: 'Back Bumper', type: 'SCUFF', coords: { surfacePoint: { fx: -2, fy: 0.2, fz: 0.1 } } },
    { id: 'y', part: 'Front Bumper', type: 'SCRATCH' },
  ])
  assert.equal(pins.length, 2)
  assert.ok(pins[0].point.fz < 0.4)
  assert.ok(pins[1].point.fz > 0.6)
  assert.ok(pins.every(p => p.approximate))
})

test('unknown custom areas and interior reports remain in detail cards; no invented 3D impact position', () => {
  const pins = buildBuyerDamagePins([
    { id: 'custom', part: 'Somewhere by engine bay', type: 'OTHER' },
    { id: 'interior', part: 'dashboard', type: 'OTHER' },
    { id: 'valid', part: 'roof', type: 'CRACK', coords: { surfacePoint: { fx: 0.5, fy: 0.8, fz: 0.5 } } },
  ])
  assert.deepEqual(pins.map(p => p.id), ['valid'])
  assert.equal(pins[0].number, 3)
  assert.equal(pins[0].approximate, false)
})

test('no records means no markers; no public blanket plus controls', () => {
  assert.deepEqual(buildBuyerDamagePins([]), [])
})
