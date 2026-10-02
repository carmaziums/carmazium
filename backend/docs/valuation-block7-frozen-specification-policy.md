# Valuation Block 7 — deterministic seller-condition/specification adjustments

## What changed

Block 7 replaces three separate specification-price formulae with **one versioned TypeScript policy**, copied byte-for-byte to the backend, website and native-app source trees. An automated parity test compares the three modules so a web/native tweak cannot silently diverge from the backend.

The canonical backend source is `backend/src/listings/valuation-specification-policy.ts`. Version `2026-10-b7-v1` is mirrored identically at `src/lib/valuation-specification-policy.ts` and `carmazium app/carmazium app/src/lib/valuation-specification-policy.ts`.

### Immutable base and edit safety
- The authoritative market valuation remains attached to verified make/model/year/mileage and its frozen valuation journey, as in Block 2.
- Specification is calculated **from the same original frozen base**, not from the prior adjusted quote, including after a quote JSON round-trip. The result includes an optional `specificationAdjustment` object with policy version, factor, predefined reason codes and **original unadjusted price snapshot**. The snapshot includes no registration, address, owner identity, provider XML or individual listings.
- A user editing poor → excellent → poor receives the same final price as a single poor selection. Returning to neutral restores original prices/explanation; repeated edits cannot accumulate another damage penalty or duplicate text.
- Retail, private-sale and completed-auction **channel-specific** results are scaled independently from their frozen channel baselines. Block 6's observed/provisional labels and verified counts survive; opening bids and reserve guidance are **not recalculated as universal 70/90/95% percentages**. The operational auction listing opening-bid rule is separate and unchanged.

### Inputs
- Condition (excellent/fair/poor), automated exterior grade, salvage category, service history, keeper count, key count, UK compliance, named equipment, import status, gearbox, fuel type, **actual variant** and door/seat configuration all use one policy.
- The existing automatic damage grade maps **0–1 defects → grade 1; 2–3 → 2; 4–5 → 3; 6–7 → 4; 8+ → 5**. Missing or invalid defect counts are unknown; they are not silently interpreted as zero reports.
- Case, spacing, hyphens and underscores are normalized for common equivalent inputs (e.g. ST-Line vs ST LINE, semi-auto aliases and PHEV variants). AMG Line, M Sport and GR Sport equipment variants are not falsely granted the performance uplift of AMG engines/M Competition. Explicit ULEZ status takes precedence over Euro standard, avoiding double compliance adjustment. Repeated/reordered equipment does not multiply benefits.
- Result factors are bounded between **0.18 and 1.20**; extreme bounds appear as explicit reason codes. These factors remain CarMazium's **provisional existing heuristic magnitudes**, not independently established real-world resale effects. Block 9 must calibrate actual coefficient magnitudes using verified transaction data.

### Fallback handling
- Registered vehicles continue to fail closed on identity/backend errors; no local calculation overrides an authoritative failed verification.
- In registration-free website/native fallback only, start from a neutral estimate, append a LOW-confidence provisional/identity message and then apply specification **once**, preserving that message through subsequent seller edits. Browser-only advertised comparables never claim achieved sale evidence.

## CI and staging sign-off
1. Maintain complete six-PR dependency chain and clear earlier DVLA/MOT verification, PostgreSQL concurrency, licensed-data contractual use and provider timeout staging gates.
2. Run the policy parity test, grade boundaries (0–8+), blank/unknown fields, case/hyphen/fuel aliases, owners/keys, ULEZ precedence, equipment order/duplication and factor caps.
3. Replay the October valuation audit: same car registration/mileage after repeatedly changing condition, specification and damage; verify one frozen market base, identical price when returning to a previous answer, and no additional external web attempts on edits.
4. Verify actual website, iOS and Android valuation flows use the correct selling-channel guide and preserve observed/provisional confidence and explanation. Reverify the separate operational auction opening-bid rule without silently changing seller-entered values.
5. Compare new estimates against validated genuine UK transactions; review model-specific sensitivities and coefficients before production. Coefficient changes must be new versioned, separately tested releases (not silently changed in one client).
6. Confirm provider credentials, VRMs, customer-identifiable data and third-party comparables are excluded from policy reason codes and baseline adjustment metadata; check logs and performance.
7. **Keep this PR draft.** Full GitHub CI success is necessary but not equivalent to staging sign-off. No production deploy, app-store release or Block 8 changes are authorised here.
