# Native 3D damage viewer — touch and performance repair (11 October 2026)

## Reported symptom
On the Android listing details screen, dragging the 3D generic car to rotate/tilt also moves the entire page; controls feel unresponsive. The screenshot shows the buyer-facing Condition & Damage viewer and the underlying seller and offer controls.

## Root cause and contained remediation
- `ThreeDVehicleViewer` renders an offline Three.js OrbitControls scene inside a nested React Native WebView, itself inside the parent detail `ScrollView`. Previously there was **no coordination** between the car's orbit gesture and the parent's vertical scroll gesture. Setting `scrollEnabled={false}` on the embedded WebView alone never disables the enclosing React Native ScrollView.
- The native wrapper now reports touch start/end/cancel and WebView OrbitControls start/end to the parent. The retail details, auction details and seller media-step ScrollViews temporarily use `scrollEnabled={!is3DInteracting}` only during the viewer interaction. Gesture-end and viewer-unmount restore normal page scrolling.
- The embedded HTML and WebGL canvas use `touch-action:none`, `overscroll-behavior:none`, and retain `controls.enablePan=false` / `enableZoom=false`. No user data or image markup changes.
- Dedicated accessible left/right rotate and up/down tilt **buttons below** (not covering) the 3D viewport allow reliable interaction without the scroll gesture; buttons enable only after the bundled GLB emits `modelReady`. Tilt remains within the camera's original polar limits. Hotspot geometry, marker tap actions, seller hide/photo workflow and buyer read-only behaviour are unchanged.
- The renderer is no longer submitted to the GPU every animation frame when idle. OrbitControls damping continues, but actual frames and bridge hotspot coordinates are scheduled only after camera/model changes; at most 10 position updates per second while moving, with the settled final update. WebGL DPR cap is 1.5 instead of 2, reducing pixel fill (potential small sharpness tradeoff).
- WebView source object and hotspots are memoised; identical coordinate updates no longer trigger React Native state rerenders. Offline Three.js and GLB asset caches remain intact.

## Acceptance / QA
Automated regression test: `scripts/test-native-3d-gesture-performance.test.mjs`, wired to Release Certification. Test checks offline source syntax, native parent scroll lock, touch release/unmount, accessibility, projection, GLB readiness, and preservation of payment and viewer actions.

**Requires physical Samsung device verification** before any merge/release: start dragging horizontally and vertically in the viewer and ensure the PAGE does not scroll; release gesture then page scrolling must resume instantly. Test buttons, front/rear/top tilt, damage zone presses, no-damage state, photographer actions in seller listing, navigation away mid-gesture, app resume, repeated screen mounts, network offline, older Android devices and iPhone, and CPU/GPU performance before/after. The WebView-to-React-Native event bridge and native touch arbitration need device testing; static CI cannot prove them.

## Release boundary
Isolated from theme PRs #501–#509; do not assume WIP app theme branch contains this fix. No public APK gate change, no production credentials, no bidding, verification or funds-flow changes, no binary signed or distributed. Build a **new private QA APK with this branch's exact commit** after successful CI and explicit review, never the old `main@74037bf` build. Do not claim Block 10 visual/release signoff based solely on source tests. 
