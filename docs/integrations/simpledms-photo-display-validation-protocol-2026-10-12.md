# SimpleDMS representative photo display-validation protocol

**Date:** 12 October 2026  
**Scope:** Isolated SimpleDMS / BuySmart Preview only  
**Status:** Prepared; no production photo approval

## Purpose

Validate how representative CarMazium vehicle photographs render in BuySmart without using legacy customer photographs or treating the exercise as production approval.

## Test asset requirements

Use only a small controlled set of representative vehicle images for which CarMazium has clear permission to use for integration testing.

The test set must:
- contain no customer identity or contact information;
- contain no private documents, KYC, handover or payment evidence;
- avoid visible real registration marks unless CarMazium has explicitly approved that exact test image;
- avoid people, house numbers or other unnecessary identifying background detail where practicable;
- be served only from an approved public image host already permitted by the partner-feed allowlist;
- be marked/documented internally as staging-display test assets.

## Expected SimpleDMS behaviour

SimpleDMS should confirm:
- images are rendered from the approved public URLs and are not fetched from private CarMazium paths;
- aspect ratio, orientation and responsive display work on desktop and mobile-browser layouts;
- a live refresh does not create duplicate historical image records;
- an image removed or replaced in the CarMazium live snapshot is correspondingly removed/replaced in the live Preview;
- when the auction/listing is no longer live, photographs are removed from the live presentation after the agreed reconciliation/staleness rules;
- photographs are not retained in the historical vehicle/event evidence store;
- report/history records do not embed or reconstruct the photographs after live removal;
- operational caches are limited to the live-display purpose and are cleared under the agreed lifecycle.

## Evidence requested from SimpleDMS

Provide redacted evidence showing:
1. representative images displayed against the synthetic live auction;
2. responsive desktop and mobile-browser rendering;
3. live replacement/removal after a complete refresh;
4. ended/non-live state with no historical photograph retained;
5. confirmation that no private URL, raw customer document or unrelated image field was ingested.

## Important boundary

Passing this protocol does not authorise use of legacy customer photographs and does not enable production. Production photograph sharing remains limited to listings covered by the final approved Terms/Privacy/lawful-basis treatment, recorded partner-distribution acknowledgement, approved host/path controls and bilateral go-live approval.
