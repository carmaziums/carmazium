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


test('mobile hero never mounts autoplay video, while desktop and reduced-motion rules remain respected', () => {
  assert.match(home, /const \[showHeroVideo, setShowHeroVideo\] = useState\(false\)/)
  assert.match(home, /window\.matchMedia\("\(min-width: 768px\)"\)/)
  assert.match(home, /window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)/)
  assert.match(home, /setShowHeroVideo\(desktop\.matches && !reducedMotion\.matches\)/)
  assert.match(home, /desktop\.removeEventListener\("change", update\)/)
  assert.match(home, /reducedMotion\.removeEventListener\("change", update\)/)
  const background = home.slice(home.indexOf('Mobile/reduced-motion visitors'), home.indexOf('<div className="absolute inset-0 dark:bg-gradient'))
  assert.match(background, /<Image[\s\S]*src=\{heroPosterSrc\}[\s\S]*priority/)
  assert.match(background, /\{showHeroVideo && \([\s\S]*<video[\s\S]*<source src=\{heroVideoSrc\}/)
  assert.match(background, /autoPlay/)
  assert.match(background, /preload="none"/)
})
