# CarMazium native Light/Dark/System programme — Block 4/10

Date: 11 October 2026 · Issue #502 · **40% source-development checkpoint**.

This block is stacked on theme/navigation PR #505 (and prior #504/#503/#501). It remains review-only: **no new APK was signed or made public** and the user-facing appearance switch remains deliberately unavailable.

## Converted shared surfaces

- `components/Button.tsx`: primary red actions always use white text; outline/ghost and neutral dark-style buttons now use semantic foreground/background/border values in both modes. Loading, disabled state, accessibility and touch targets unchanged.
- `components/IconButton.tsx`: neutral solid/circle fills, icon foreground defaults and borders adapt to the native palette, retaining required screen-reader labels and minimum touch dimensions.
- `components/ui/Card.tsx` and `components/GlassCard.tsx`: glass, solid, outline, elevation/clip layouts and visual border use website semantic light/dark tokens. Existing iOS clipped-shadow separation is preserved.
- `components/BottomSheet.tsx` and `components/Toast.tsx`: shared overlay, panel, title, close controls, notification text and border now theme-aware. Native draggable header and keyboard avoidance preserved.
- `components/ThemedTextField.tsx`: common native input with semantic field/text/border/placeholder/selection colours and matching system keyboard appearance; forwards native TextInput props/ref. Applied to profile-completion and location prompts without changing validation or `/users/me` payloads.
- `components/filters/AuctionFilterSheet.tsx`: shared auction filter's typed fields, make/body/fuel/transmission pills, filter headings and reset panel use the active palette. Preserves draft-filter edits, Apply/Reset actions, transmission options, dynamic make list and numerical keyboards.

## Verification and limitations

- New `scripts/test-native-theme-shared-controls-block4.test.mjs` checks both palette contracts, shared controls and read-only static contracts for user forms and filters. Added to `Release Certification`.
- Full TypeScript, Product Parity, web and backend CI must pass on the current draft head before calling this a green checkpoint.
- **Not complete across all screens:** feature-specific `VehicleCard`, `HorizontalVehicleCard`, search and auction list content, Sell/vehicle detail flows, dealer workspace, messaging and MaziuM still contain hard-coded dark styles. Blocks 5–9 will migrate those. The shared cards updated here do not imply individual car information cards are converted.
- **No Appearance picker:** app shows existing dark design until all major user screens can switch without invisible text. Theme storage from Block 2 is still internal.
- **No on-phone visual acceptance:** perform Samsung and real iPhone light/dark/System screenshots with large-text and keyboard tests when the full migration is ready. Source-level CI is not equivalent to visual/device testing.
- **Safety:** no role/auth backend, fees, bids, payment, KYC, production DB, signing secrets or public APK/TestFlight upload changes. `/download-app` remains gated and disabled.
- Previous menu repair #501 is preserved. Do not merge overlapping drafts independently; the latest stacked PR is the unified review candidate.

**Stop at 40%.** Await explicit `proceed` for Block 5: buyer homepage, search, retail and live-auction discovery surfaces.
