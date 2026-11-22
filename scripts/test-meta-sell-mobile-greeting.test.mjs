import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const widget = readFileSync(new URL('../src/components/features/MaziumWidget.tsx', import.meta.url), 'utf8')
const loader = readFileSync(new URL('../src/components/features/MaziumWidgetLoader.tsx', import.meta.url), 'utf8')

test('mobile /sell pages do not show a promotional chat bubble over the valuation button', () => {
  const greeting = widget.split('{/* Greeting Pop-up */}')[1]?.split('{/* One close control')[0]
  assert.ok(greeting, 'greeting rendering section should exist')
  assert.match(greeting, /pathname === "\/sell"/)
  assert.match(greeting, /pathname\.startsWith\("\/sell\/"\)/)
  assert.match(greeting, /"hidden md:flex" : "flex"/)
})

test('the chat launcher remains available and the AI can still be opened by the visitor', () => {
  const launcher = widget.split('{/* One close control')[1]
  assert.ok(launcher)
  assert.match(launcher, /onClick=\{handleToggle\}/)
  assert.match(launcher, /Open Mazium AI assistant/)
  assert.match(loader, /return ready \? <MaziumWidget \/> : null/)
})

test('widget remains delayed on seller acquisition pages for first-paint performance', () => {
  assert.match(loader, /pathname\?\.startsWith\("\/sell"\)/)
  assert.match(loader, /setTimeout\(\(\) => setReady\(true\), 5000\)/)
})
