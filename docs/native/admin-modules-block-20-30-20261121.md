# CarMazium Android/mobile website parity — Admin block 20–30%

**Checkpoint:** 30% of the ten-block audit plan, NOT 30% feature parity.
**Status:** source implementation and tests checked; runtime verification of the changes remains pending. The installed Android build is still 121. Pause after this block until the user says "proceed".

## Direct role-matched evidence

On 21 November 2026, the same signed-in CarMazium admin account was confirmed on Android and the live website in the same BlueStacks SM_S908E emulator in the previous block. This block used the same emulator, Android app and live Chrome sessions. Read-only website screenshots:

- `C:\Users\Dell\CarMazium-QA-Tools\admin-tx-web.png`: Transaction Ledger, filter controls, payment states and report-fulfilment actions.
- `C:\Users\Dell\CarMazium-QA-Tools\admin-auctions-web.png`: Auction Management with search, seller, vehicle and status columns.
- Installed build 121 remains source of truth for existing native deficiencies. It uses website fallbacks for both modules (previous native admin dashboard screenshot and source).

Reference observations: Website ledger showed approximately 1,030 records and Auction Management approximately 824 at capture time. Those are changing live counts, not fixed test assertions. Screenshots can contain third-party customer details and must remain in the secure QA directory; do not circulate them.

## What was changed in the isolated development branch

1. Added `AdminTransactionsScreen.tsx` as a **native read-only** Transaction Ledger, using GET `/admin/transactions` with page, limit, customer/registration/payment-reference search, payment type and status, and From/To (UTC) date filters. Shows transaction amount, customer, listing, dates, status, HPI report state and expandable payment metadata. Never counts pending checkout as received. Important: CSV export, HPI upload/preparation and user-modal details are not yet full website parity.
2. Added `AdminAuctionsScreen.tsx` as a **native read-only** Auction Management list using GET `/admin/auctions`, search, pagination, seller information, listing photos, VRM/year, auction status, reserve, highest bid, bid count, winner and links to existing native admin account details. Correct-reserve, assign-winner and listing-editor actions remain unimplemented, so this is **partial** parity.
3. Added `AdminBottomNav.tsx` and a role-gated native-stack wrapper for the website's admin bottom bar, with Overview, Listings, Transactions, Messages and More. The first three use native routes. The Messages path is still an explicitly marked external website fallback. More lists admin tools, distinguishing native versus website destinations.
4. Updated the admin dashboard and native card catalog so Auctions and Transactions navigate to those native screens rather than opening the browser.
5. The new screens share the existing admin authorization gate `withAdminGate`; the server continues to enforce auth on admin endpoints. Read-only GET endpoints do not mutate live records.

## Verification

- 21 focused Jest tests passed across admin read-only records, admin dashboard cards and native tour. Tests include endpoint/query fidelity and payment-state formatting.
- ESLint passed for the changed files.
- TypeScript `tsc --noEmit` passed.
- The new source has **not been installed and visually tested in the emulator**. This block does not warrant "pixel-perfect", "100% parity", or production release approval.
- Installed `uk.carmazium.app` build 121 and its local session/data are unchanged. Public website download remains at build 111 according to the existing rollout hold. No production payment, payout, auction correction, seller assignment, listing approval, user role change, or messaging operation was executed.

## Remaining admin module gaps

- Admin Messages still launches the website; native admin messaging/agent workflow remains absent.
- Cancellation management, warranty orders, HPI creation and PDF upload, free grants, all dealers, trade services, finance providers, analytics, AI reports, marketing popup and blog administration still have external fallbacks.
- The website's full listing-management grid is richer than the current native pending-review screen; needs deeper workflow parity.
- Transaction ledger still lacks CSV export and native HPI report mutations. Auction Management still lacks native price corrections, winner assignments and editing (high impact, must require explicit confirmations and QA before use).
- Admin bottom navigation has only TypeScript/unit-level verification. The actual runtime navigation, account guard, modal layout and screen spacing must be validated with an isolated signed QA build before public release.
- The website-versus-native paired screenshots of the NEW admin pages cannot yet be captured because only old build 121 is installed.

**Next permitted block only after the user's explicit "proceed":** 30–40% dealer-to-dealer account parity. Admin items above remain unresolved defects in the backlog and should be revisited before the 90–100% release gates.
