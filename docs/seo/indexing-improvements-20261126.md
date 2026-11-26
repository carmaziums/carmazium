# CarMazium indexing follow-up — 26 November 2026

## Observed baseline

Search Console's www property reported 899 indexed URLs and 123 excluded URLs, with the Page indexing report labelled last updated 16 November 2026. Of those excluded URLs, 58 were discovered but not indexed, 38 crawled but not indexed, 22 noindex, three alternate canonicals and two robots exclusions. Google last read sitemap.xml successfully on 24 November, discovering 969 URLs. No manual actions or security issues were reported. Core Web Vitals showed 216 good URLs on each device class and no poor URLs.

The six newly published articles were initially absent from the hourly cached sitemap (110 articles). The stock-feeds article was unknown to Google's index but passed the live URL test. This establishes crawl eligibility, not indexing or ranking. No indexing guarantee is implied.

## Backlog review

All 96 URLs from the discovered/crawled report were checked against current public responses and the sitemap. They comprise 74 vehicle URLs, 15 articles, one tag archive and six other pages. All 15 articles returned HTTP 200 with index/follow, one H1 and self-referencing canonicals. This technical review does not establish why Google has deferred indexing.

85 URLs appeared in the sitemap snapshot. The other URLs include a deliberately noindex thin tag archive, the old /business route (404), a warranty terms page canonicalised to the warranty service, a seller profile, and removed vehicles. Five vehicle pages still had cached public HTML while their direct public backend lookups returned 404; two others already rendered Next.js's missing-page noindex output. Do not re-add removed vehicles to the sitemap or request their indexing. The BMW M4 titled “STANDARD EXAMPLE” is a genuine unmodified-vehicle description, not evidence of a seeded test record.

## Change

- Successful browser admin create/update/delete operations request an authenticated, fixed-scope public-blog cache refresh. It expires tagged blog reads, blog routes and sitemap.xml. The backend's existing admin guard verifies the current identity and database role. Client input cannot choose paths, cache tags or upstream destinations. Scheduled revalidation remains the fallback for failed refresh requests and jobs writing directly to the backend.
- Blog cover uploads preserve the artwork and aspect ratio, encode WebP at up to 1600px, and upload 480/960/full-width variants where the original is large enough. The returned URL is exposed only after every variant succeeds. Existing images without the variant filename contract retain their original URL.
- Public article, index, tag and homepage cards use these pre-generated variants. Vercel's globally disabled image optimisation remains disabled because the repository records past quota-related broken images.
- Add a visible topic directory for established seller/service/dealer guides and relevant dealer-guide links from trader pricing. Preserve article URLs, copy, publication dates and editorial noindex choices.

## Validation before publication

42 focused runtime/SEO regression checks pass, including unauthenticated and denied-admin cache refresh, upstream failure, fixed cache scope, responsive widths and existing blog indexing contracts. TypeScript check passes. Production build and live checks are recorded in the PR/release outcome.

## Follow-up

After deployment, re-upload the six original covers through the new admin upload path and save them, verify the three public variants and sitemap membership, then submit the sitemap and selected useful unindexed pages in Search Console. Google controls whether and when those pages are indexed; do not repeatedly submit the same URLs or validate intentional noindex/robots exclusions as errors.

CI follow-up: the executable cache/cover tests run in the web job after dependency installation. Reviewed the trader-pricing addition: it only adds existing guide links; pricing, permissions and payment facts are unchanged. Refreshed its MaziuM knowledge-source fingerprint.
