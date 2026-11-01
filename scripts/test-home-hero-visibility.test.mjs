import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const home = readFileSync(new URL('../src/app/HomeClient.tsx', import.meta.url), 'utf8')
test('primary homepage hero content is visible before client hydration', () => {
  const fullHero = home.slice(home.indexOf('{/* Cinematic Hero Section */}'))
  const hero = fullHero.slice(0, fullHero.indexOf('</motion.div>') + '</motion.div>'.length)
  assert.match(hero, /<motion\.h1[\s\S]*?initial=\{false\}/)
  assert.match(hero, /Auction <span/)
  assert.match(hero, /<form/)
  assert.equal((hero.match(/initial=\{false\}/g) ?? []).length, 4)
  assert.doesNotMatch(hero, /initial=\{\{ opacity: 0, y: (20|30)/)
  assert.match(home, /<video[\s\S]*?poster=\{heroPosterSrc\}/)
})
