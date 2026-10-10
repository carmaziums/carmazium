# Native app audit — Block 10: onboarding parity

**Observed evidence:** Android 15 emulator successfully installed and cold-launched the read-only CarMazium QA APK, build source `a00059301e4ec35f3732c19c12610960de760d63`, in [Actions run #38011657011](https://github.com/carmaziums/carmazium/actions/runs/38011657011). That workflow captured a logged-out screenshot showing the original onboarding claim **"Britain's most curated car marketplace."**

## Confirmed mismatch against the current website
- Website `src/app/HomeClient.tsx` leads with **"Sell Your Car Your Way"**, **"Auction FREE · Retail £1"** and **£100 successful-auction seller reward**.
- Native `OnboardingScreen.tsx` instead opened with an unsupported UK-marketplace superlative and did not explain the two actual sale routes.
- Slide 2 said MaziuM AI would handle "finance, the lot"; the NEXT carousel button was labelled "TRY IT" although it did not start AI.
- Slide 3 invited ordinary visitors to bid without explaining that auctions are dealer-only and winning dealer buyers owe a £125 platform fee.

## Change
- Slide 1 now mirrors the core website selling proposition: **FREE dealer auction, £1 retail listing, and £100 seller reward subject to successful auction sale and approved handover**.
- Slide 2 describes existing search and MaziuM AI listing-matching help, without unsupported financing promises. Button says NEXT.
- Slide 3 clearly distinguishes browsing from auction bidding: verified motor traders can bid, winning dealer fee £125, retail buyer fee £0. Final CTA says SIGN IN.
- Existing background images, carousel, skip button and auth state transitions remain intact.
- Regression checks assert marketing claims, fee distinctions, role restrictions and navigation, and are part of release certification.
- QA build workflow regenerates an isolated Android APK on main when the onboarding code changes; `uk.carmazium.app`, production Google Play signing, iOS and live OTA are untouched.

**Not claimed:** exact website/app pixel equivalence, authenticated device QA or iPhone QA. Verify the next built APK and its emulator screenshot before calling the revised welcome screen visually correct.
