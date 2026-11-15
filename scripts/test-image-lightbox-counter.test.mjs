import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

// Minimal hook/host fixture: commit refs before running effects and retain state
// across the portal's delayed mount. No browser or additional CI dependency.
function gallery(initial = {}) {
  const slots = [], effects = [], timers = new Map(), listeners = new Map()
  let cursor = 0, dirty = true, tree, track, timerId = 0
  let props = { images: Array.from({length: 14}, (_, i) => `/photo-${i}.jpg`), alt: 'Vehicle', open: false, onClose: () => {}, ...initial }
  const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]))
  const React = {
    useState(value) {
      const i = cursor++; slots[i] ??= { value }
      return [slots[i].value, next => { next = typeof next === 'function' ? next(slots[i].value) : next; if (!Object.is(next, slots[i].value)) { slots[i].value = next; dirty = true } }]
    },
    useRef(value) { const i = cursor++; slots[i] ??= { ref: {current: value} }; return slots[i].ref },
    useCallback(fn) { cursor++; return fn },
    useEffect(fn, deps) {
      const i = cursor++, previous = slots[i]
      if (!same(previous?.deps, deps)) effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = fn() })
      slots[i] = { deps, cleanup: previous?.cleanup }
    },
  }
  const document = { body: {style: {overflow: ''}}, activeElement: {focus() {}} }
  const window = { setTimeout(fn) { timers.set(++timerId, fn); return timerId }, clearTimeout(id) { timers.delete(id) }, addEventListener(name, fn) {listeners.set(name, fn)}, removeEventListener(name, fn) {if (listeners.get(name) === fn) listeners.delete(name)} }
  const jsx = (type, props) => ({type, props})
  const exports = {}
  const source = readFileSync(process.env.LIGHTBOX_SOURCE || new URL('../src/components/features/ImageLightbox.tsx', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022}}).outputText
  runInNewContext(compiled, {exports, window, document, IntersectionObserver: class {observe() {} disconnect() {}}, require(id) {
    if (id === 'react') return React
    if (id === 'react/jsx-runtime') return {jsx, jsxs: jsx}
    if (id === 'react-dom') return {createPortal: child => child}
    if (id === 'next/image') return {default: 'img'}
    if (id === 'lucide-react') return {X: 'x', ChevronLeft: 'left', ChevronRight: 'right'}
    if (id.endsWith('vehicleImagePresentation')) return {parseVehicleImagePresentation: src => ({src})}
    throw new Error(id)
  }})
  const nodes = (node) => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(x => nodes(x)) : [node, ...nodes(node.props?.children)]
  function flush() {
    for (let guard = 0; guard < 30; guard++) {
      if (dirty) {
        dirty = false; cursor = 0; tree = exports.ImageLightbox(props)
        for (const slot of slots) if (slot?.ref) slot.ref.current = null
        const host = nodes(tree).find(n => n.props?.ref && n.props.className?.includes('snap-mandatory'))
        if (!host) track = undefined
        else {
          track ??= {clientWidth: 390, scrollLeft: 0, querySelectorAll: () => [], scrollTo({left}) { this.scrollLeft = left; this.onScroll?.({currentTarget: this}) }}
          track.onScroll = host.props.onScroll; host.props.ref.current = track
        }
        for (const node of nodes(tree)) if (node.props?.ref && node !== host) node.props.ref.current = {focus() {}, querySelectorAll: () => []}
        while (effects.length) effects.shift()()
        continue
      }
      if (timers.size) { const batch = [...timers.values()]; timers.clear(); batch.forEach(fn => fn()); continue }
      return
    }
    throw new Error('Gallery did not settle')
  }
  function text(node) { return node == null ? '' : typeof node !== 'object' ? String(node) : Array.isArray(node) ? node.map(text).join('') : text(node.props?.children) }
  flush()
  return {
    update(next) { props = {...props, ...next}; dirty = true; flush() },
    swipe(photo) { track.scrollLeft = photo * track.clientWidth; track.onScroll?.({currentTarget: track}); flush() },
    get counter() { return nodes(tree).map(n => text(n)).find(value => /^\d+ \/ \d+$/.test(value)) },
    get visiblePhoto() { return Math.round(track.scrollLeft / track.clientWidth) },
    click(label) { const button = nodes(tree).find(n => n.type === 'button' && n.props['aria-label'] === label); assert.ok(button); button.props.onClick({stopPropagation() {}}); flush() },
    key(key) { listeners.get('keydown')?.({key, preventDefault() {}}); flush() },
    get bodyOverflow() { return document.body.style.overflow },
    get mounted() { return !!tree },
  }
}

test('native horizontal swipes update the full-screen counter in both directions', () => {
  const g = gallery(); g.update({open: true})
  assert.equal(g.counter, '1 / 14')
  for (const index of [1, 2, 8, 13, 7, 0]) { g.swipe(index); assert.equal(g.counter, `${index + 1} / 14`) }
  g.swipe(-0.8); assert.equal(g.counter, '1 / 14')
  g.swipe(14.5); assert.equal(g.counter, '14 / 14')
})

test('opening and reopening at a later photo aligns the mounted track with its counter', () => {
  const g = gallery(); g.update({open: true, startIndex: 5})
  assert.equal(g.visiblePhoto, 5); assert.equal(g.counter, '6 / 14')
  g.swipe(8); g.update({open: false}); assert.equal(g.mounted, false); assert.equal(g.bodyOverflow, '')
  g.update({open: true, startIndex: 10}); assert.equal(g.visiblePhoto, 10); assert.equal(g.counter, '11 / 14')
})

test('arrows, keyboard and thumbnails stay aligned after a swipe', () => {
  const g = gallery({open: true}); g.swipe(4)
  g.click('Next image'); assert.equal(g.visiblePhoto, 5); assert.equal(g.counter, '6 / 14')
  g.key('ArrowLeft'); assert.equal(g.visiblePhoto, 4); assert.equal(g.counter, '5 / 14')
  g.click('Go to image 14'); assert.equal(g.visiblePhoto, 13); assert.equal(g.counter, '14 / 14')
})

test('a single image and a clamped starting index stay within the gallery bounds', () => {
  const g = gallery({images: ['/only.jpg'], open: true, startIndex: 99})
  assert.equal(g.visiblePhoto, 0); assert.equal(g.counter, '1 / 1')
  g.swipe(2); assert.equal(g.counter, '1 / 1')
})
