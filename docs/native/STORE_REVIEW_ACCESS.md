# Store Reviewer Access Contract

CarMazium contains account-based features and role-gated functionality. Apple App
Review and Google Play review therefore need working, reusable access that exposes
the submitted build's material functionality.

## Never store reviewer passwords in Git

Reviewer usernames/passwords, one-time bypass tokens, KYC evidence and payment
test credentials are release secrets. Enter them directly in App Store Connect
and Play Console.

The repository records the required account roles and review journey only.

## Required reviewer accounts

Maintain dedicated review accounts against the production reviewable backend:

1. **Standard member (buyer/seller)**
   - can sign in with email/password;
   - has access to search, saved vehicles, seller listing flow, messages,
     notifications, settings, Privacy Policy and in-app account deletion;
   - should have representative non-sensitive test data so empty states do not
     prevent review.

2. **Verified dealer / motor-trade account**
   - already past business/KYC approval;
   - can browse live auctions and exercise dealer-only bidding/workspace
     functionality without waiting for manual approval;
   - should not require location-specific credentials, expiring OTP or a
     reviewer-controlled external mailbox.

3. **Partner/service-provider account**
   - provide if partner/service workflows are enabled in the submitted build;
   - should already be approved for at least one representative capability so
     the reviewer can open the partner dashboard and jobs/leads flow.

If one dedicated account can switch between roles without weakening production
authorisation, document that exact switch path in the console. Otherwise provide
the additional accounts in review notes/app-access instructions.

## Authentication requirements

Review credentials must:

- remain valid for the whole review period;
- work from outside the developer's location/network;
- avoid expiring passwords;
- avoid mandatory OTP/2FA unless the review instructions contain a permanent,
  reusable review mechanism accepted by the store;
- be written in English;
- never be a real customer's account.

## App Review / Play review notes

Use this as the baseline explanation and replace only the bracketed external
credential references in the store consoles:

> CarMazium is a UK used-vehicle marketplace for users aged 18+. Private sellers
> can create retail listings and timed auction listings. Auction bidding is
> restricted to approved motor-trade/dealer accounts. Vehicle purchase money is
> paid directly between buyer and seller; CarMazium does not hold the vehicle
> purchase price. The app may charge clearly disclosed CarMazium platform/listing
> fees and can administer eligible seller incentives.
>
> Review account access is supplied in the store's secure review-credentials
> fields. Use the standard member account for search, selling, saved cars,
> messaging, settings and account deletion. Use the verified dealer account for
> dealer-only auction bidding and dealer workspace features. [If included:
> use the approved partner account for service-provider workflows.]
>
> MaziuM AI is optional. Before interactive AI data is sent to OpenAI the app
> presents a disclosure and requires acknowledgement. AI responses can be
> reported. Device location is requested only when the seller taps Locate Me.
> Photo/document upload uses system pickers; the current production app does not
> require camera, microphone or background location permission.
>
> Account deletion is available in Settings and at
> https://www.carmazium.com/delete-account. Support:
> https://www.carmazium.com/app-support. Privacy:
> https://www.carmazium.com/privacy-policy.

## Before submission

Confirm all reviewer accounts by installing the same signed build that will be
submitted and signing in over a normal external mobile connection. Verify that
the backend remains enabled for the entire review window.
