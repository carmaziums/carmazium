# CarMazium native app visual comparison — Block 8

**Status:** Test-only UI improvements prepared; installed Android or iOS parity is *not* certified by CI.

The standalone Android QA installer created in Block 7 is a separately signed, read-only build. Block 8 makes the unified **Account settings** shortcut visible immediately beneath the user identity in the side drawer instead of buried after all dealer/customer tools. Personal information, dealer information, verification, notifications/privacy, bank/payouts and account security remain within the same existing settings screen.

**Only the QA build** shows a **Share QA feedback** shortcut alongside it. This opens Android's native share sheet with the Git commit SHA, device platform/version, and a checklist of what differs from the website. It does not send any content automatically. The tester chooses the recipient and should attach a screenshot or screen recording separately, avoiding personal/customer information and credentials.

## Android QA reinstallation

The earlier read-only APK build is at [Actions run #38007055894](https://github.com/carmaziums/carmazium/actions/runs/38007055894), build source `50a0f6ba41b941498fe3d5f2b809cdece537b280`. That build **does not contain Block 8**. Check the succeeding Actions run after Block 8 has landed on `main`, and obtain the newly generated `CarMazium-Android-QA` artifact there.

Each Actions runner may use a fresh ephemeral Android debug-signing key. Consequently, Android can reject an in-place update to `uk.carmazium.qa` due to a signature mismatch. Uninstall **only CarMazium QA** from the phone, then install the new APK. Do not uninstall the separate production `CarMazium` (`uk.carmazium.app`). Never override Play Protect for random APKs or install untrusted URLs.

## Compare against carmazium.com

Open the same screens on the website and QA app using the same device. Compare the header, drawer, primary buy/sell journeys, live/retail car details including transmission, cards and trust badges, saved cars, account settings category navigation, and MaziuM AI floating assistant. For each mismatch, capture what was displayed, expected text/position/colour, user role (non-sensitive), app source SHA, page name and a screenshot. Note accessibility/contrast and Android back gesture problems.

**Important:** The QA installer connects to the live backend, even though it intentionally blocks common mutating API requests and storage uploads. It must not be used with real customer transactions, identity documents or payments. Source CI does not replace physical-device verification. iOS still needs Apple signing and actual iPhone testing.
