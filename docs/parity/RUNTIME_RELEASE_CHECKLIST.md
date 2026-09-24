# CarMazium One Product — Runtime Release Evidence Checklist

**Repository remediation checkpoint:** 100%  
**Code-contract parity:** PASS  
**Runtime release certification:** PENDING EXTERNAL EVIDENCE

This document is the evidence ledger for the final 20%. A box is checked only when the named artifact or runtime observation exists. Repository code, CI, emulators and inferred configuration are not substitutes for signing/device/browser evidence.

## Verified repository / PR evidence

- [x] Exact PR code candidate: `7217c48471a477f303e1c221417ddff34685c6a4`.
- [x] One Product parity workflow green on that exact code SHA.
- [x] Backend full test/build CI green on that exact code SHA.
- [x] Web production build green on that exact code SHA.
- [x] Mobile TypeScript/build-preflight checks green on that exact code SHA.
- [x] Both Vercel preview projects READY for that exact code SHA.
- [x] Exact preview runtime error/fatal query returned no entries.
- [x] Representative currently deployed public web routes return HTTP 200.
- [x] Apple/Android association handlers exist in code and fail closed until real signing values are configured.
- [x] Server-rendered Fly fetches use bounded timeout/retry/backoff after production telemetry showed transient resets/timeouts.

## 80% → 90% — Release candidate evidence

- [x] Common release identity contract uses the exact Git SHA across web/backend/native artifacts.
- [ ] Record the exact production release candidate Git SHA.
- [ ] Confirm One Product parity workflow is green on that exact SHA.
- [ ] Confirm backend full test/build CI is green on that exact SHA.
- [ ] Confirm web production build is green on that exact SHA.
- [ ] Confirm mobile TypeScript/build-preflight checks are green on that exact SHA.
- [ ] Produce a signed Android APK/AAB using the real release signing configuration.
- [ ] Record signed Android artifact size and compare it with the documented prior ~65–68 MB APK baseline.
- [ ] Run onboarding, marketplace search/detail, auction, dealer dashboard and Partner/TradeXchange journeys on a physical Android device.
- [ ] Record any crash, memory-pressure or material scroll/jank finding.
- [ ] Verify representative web preview/runtime journeys against the same backend.

## 90% → 100% — Production association, accessibility and release evidence

- [ ] Record production/preview LCP, INP and CLS evidence for representative public pages.
- [ ] Complete keyboard-only checks on representative web journeys.
- [ ] Complete screen-reader checks on representative web/native journeys.
- [ ] Obtain the real Apple Team ID + bundle/application identifier.
- [ ] Publish and verify `/.well-known/apple-app-site-association` / Apple association content for CarMazium routes.
- [ ] Obtain the real Android release-signing SHA-256 fingerprint.
- [ ] Publish and verify `/.well-known/assetlinks.json`.
- [ ] Verify cold-start universal/app links on signed physical-device builds.
- [ ] Publish the tested native JavaScript bundle to the authenticated production Expo Updates channel, or ship a signed store build when native configuration changed.
- [ ] Confirm the production web deployment and backend deployment correspond to the approved release candidate.
- [ ] Record final production smoke-test result and release SHA(s).

## Evidence rules

1. Do not guess signing IDs, certificate fingerprints, store credentials, Expo credentials, performance measurements or accessibility outcomes.
2. If a test cannot be run with the available authenticated environment, leave it unchecked and record the blocker.
3. Any code change after evidence collection creates a new release candidate and requires the affected gates to be rerun.
4. Admin web-only operations and the SEO blog remain approved platform-specific boundaries; they are not native-app release blockers.
