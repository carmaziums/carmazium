# Native Store Accessibility & Device QA Contract

This document is the code-side accessibility and device-quality contract for the
CarMazium iPhone and Android applications. It records what can be enforced from
the repository and what still requires a signed build on real hardware.

## Code-controlled accessibility requirements

CarMazium native controls must provide meaningful semantics for VoiceOver and
TalkBack. In particular:

- icon-only controls use the shared `IconButton`, which requires an
  `accessibilityLabel` and supplies button role/state semantics;
- the hamburger control announces itself as the navigation menu;
- the custom bottom navigation exposes one accessible tab target per tab and
  reports the selected state;
- shared buttons expose disabled and busy/loading state;
- report-reason selectors expose radio semantics and checked state;
- message read/seen state is expressed in words to assistive technologies rather
  than relying only on tick glyphs;
- loading/thinking status that changes asynchronously uses a polite live region
  or an equivalent spoken label.

## Touch targets

Icon controls keep at least a 44-point visual control plus expanded hit slop.
Custom bottom tabs have a minimum 48-dp row target. Compact shared buttons expand
their hit area so the effective touch target is at least 48 dp without forcing a
visual redesign.

## Reduce Motion

Automatic/repetitive motion must respond to the operating-system Reduce Motion
setting.

The shared `useReduceMotionPreference` hook is the source of truth for this.
Current protected motion includes:

- bottom-tab focus spring animation;
- private-chat typing dots;
- MaziuM AI typing dots.

Future looping, bouncing, scaling, parallax or depth-style animation must use the
same preference or otherwise provide an equivalent reduced-motion path.

## Android platform compatibility

The production Expo build is pinned to:

- `compileSdkVersion: 36`
- `targetSdkVersion: 36`

This matches the Google Play requirement in force for new apps and app updates
from 31 August 2026. Expo SDK 54 also uses Android API 36 as its supported
compile/target baseline.

## Apple build-tool compatibility

App Store Connect currently requires iOS uploads to be built with Xcode 26 or
later and the iOS 26 SDK or later. Expo confirms that SDK 54 EAS Build defaults
to Xcode 26, so the current CarMazium SDK line can satisfy this requirement.
Before submission, keep the EAS build log as release evidence that the actual
signed archive used an eligible Xcode/iOS SDK image.

## On-device release evidence

Repository checks cannot certify physical behaviour. Before store submission,
test the signed release build on representative iPhone and Android hardware.

Required manual checks:

1. VoiceOver: sign-in, bottom navigation, search, vehicle detail, sell flow,
   chat, MaziuM, settings and account deletion.
2. TalkBack: the same critical journeys and focus order.
3. Large text / Dynamic Type: at least the largest common accessibility setting;
   verify critical CTAs, prices, form labels and validation remain readable.
4. Reduce Motion: verify tab and typing animations stop/reduce when the OS
   preference is enabled.
5. Touch targets: run Android Accessibility Scanner and manually check dense
   dealer/chat controls.
6. Keyboard: verify login, seller listing, KYC, chat and MaziuM inputs remain
   visible on small screens.
7. Safe areas: test a notched iPhone and an Android device with gesture
   navigation.
8. Push: foreground, background and killed-state receipt/tap routing.
9. Payments: native Stripe Payment Sheet presentation in test mode.
10. Deep links: installed-app universal links/App Links after Block 6's real
    Apple/Google association identities are configured.

## Store reviewer access

CarMazium has account-based functionality. A final store submission must provide
reviewers with working credentials or another accepted review-access mechanism
and keep the production backend available for review. Credentials are external
release evidence and must never be committed to this repository.

Do not mark the manual device/reviewer-access section as passed merely because
CI is green.
