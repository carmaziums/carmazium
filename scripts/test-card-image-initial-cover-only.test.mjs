import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const gallery = readFileSync(new URL('../src/components/features/CardImageCarousel.tsx', import.meta.url), 'utf8')

test('listing cards fetch only the cover before a gallery interaction', () => {
  assert.match(gallery, /const \[maxReached, setMaxReached\] = React\.useState\(0\)/)
  assert.match(gallery, /\{i <= maxReached && \(/)
  assert.doesNotMatch(gallery, /\{i <= maxReached \+ 1 && \(/)
  assert.match(gallery, /loading=\{i === 0 && eagerFirstImage \? "eager" : "lazy"\}/)
})

test('swiping and arrow controls prepare adjacent photos without losing earlier slides', () => {
  assert.match(gallery, /const prepareAdjacentImage = React\.useCallback/)
  assert.match(gallery, /onTouchStart=\{prepareAdjacentImage\}/)
  assert.match(gallery, /onMouseDown=\{prepareAdjacentImage\}/)
  assert.match(gallery, /onWheel=\{prepareAdjacentImage\}/)
  assert.match(gallery, /setMaxReached\(\(prev\) => Math\.max\(prev, Math\.min\(bounded\.length - 1, index \+ 1\)\)\)/)
  assert.match(gallery, /setMaxReached\(\(prev\) => Math\.max\(prev, clamped \+ 1\)\)/)
  assert.match(gallery, /setMaxReached\(\(prev\) => \(i > prev \? i : prev\)\)/)
})
