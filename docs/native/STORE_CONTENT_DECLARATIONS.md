# Store Content, Audience & Policy Declaration Contract

This document records factual product characteristics for App Store Connect and
Google Play Console questionnaires. The store consoles remain authoritative:
answer their current questionnaires from the submitted build and do not infer a
rating merely from this file.

## Audience

- CarMazium accounts require users to be **18 or over**.
- The product is not designed for children.
- Google Play target audience should therefore be limited to the adult age group
  unless the product/legal position changes.
- Do not use a store age rating as a substitute for the contractual 18+ account
  rule.

## User-generated content

**Present.**

Users can create vehicle listings, listing media, profiles, messages and other
transaction/support content. UGC/chat reporting and moderation controls are
covered by the CarMazium safety programme.

For store questionnaires, do not answer "no user-generated content" merely
because listings are vehicle advertisements rather than social posts.

## Messaging / social interaction

**Present.**

Private member-to-member and support messaging exists. Chat is gated by product
rules and includes report/block/moderation handling where applicable.

## AI-generated content

**Present.**

MaziuM AI, AI Search and seller AI-assisted description/specification features
exist. AI consent, moderation and response reporting are implemented separately
from the store listing.

## Purchases and money

- Vehicle sale money passes directly between buyer and seller; CarMazium does
  not hold the vehicle purchase price.
- CarMazium can charge its own platform/listing/optional service fees and
  administer eligible incentives/payouts.
- Store questionnaire answers must distinguish real-world vehicle marketplace
  transactions from digital content purchases.

## Finance-related features

CarMazium can expose finance/service enquiry workflows and partner features.
Before every Play submission, review the current Google **Financial features**
declaration against the exact production build and legal service model.

Do not describe CarMazium itself as a lender, insurer or warranty underwriter
unless the production/legal model has actually changed to make that true.

## Advertising

The current native dependency graph contains no advertising SDK and the
canonical store metadata declares **Contains ads: No**.

Vehicle listings and marketplace inventory are user/business marketplace
content, not an embedded third-party mobile advertising network. If a native ad
SDK, paid promotional ad network or other store-defined advertising behaviour is
introduced, update the declaration before release.

## Gambling, medical and restricted content

Current product contract:

- real-money gambling: no;
- simulated gambling: no;
- medical/health diagnosis or treatment: no;
- background location: no;
- camera permission: no;
- microphone permission: no;
- broad Android photos/videos permission: no.

If any of these facts change, update the store declarations and the release gate
in the same change.

## Age/content rating questionnaires

Apple and IARC/Google calculate ratings from their current questionnaires.
Answer based on actual submitted content, including UGC, messaging and any
browser/web content reachable inside the app. Do not hard-code or market a
specific calculated rating until the relevant store has produced it.

## Privacy/Data safety

Use the production Privacy Policy plus
`docs/native/STORE_PRIVACY_PERMISSIONS.md` as implementation evidence. App
Store privacy labels and Play Data safety responses must include CarMazium's own
collection and integrated third-party processors used by the submitted build.
