# Phase 15: Delivery and Distance System — Research

**Researched:** 2026-06-21
**Domain:** NestJS backend (Prisma schema, REST endpoints, cron jobs), Next.js 14 App Router (seller wizard, buyer offer dashboard, search page), Google Maps Distance Matrix API
**Confidence:** HIGH — all findings verified against live project code

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Seller Delivery Setup**
- Per-listing toggle, price-per-mile, optional max-radius — three separate fields per listing
- Price unit: miles (not km) — UK convention
- Radius is optional; blank means "delivers anywhere in UK"
- Delivered in a dedicated "Delivery Options" section inside the `ListingWizard`; also editable on existing listing edit
- Out-of-radius UX: greyed-out sidebar section ("Delivery not available to your location") — not hidden
- Radius check is against the delivery address entered in the request form, NOT the buyer's GPS `LocationContext` position

**Delivery Visibility (Buyer-Facing)**
- `CarCard` gets a "Delivery available" chip (same pill style as existing fuel/mileage chips)
- "Delivery available" toggle added to the search/browse filter panel
- No live cost preview in the sidebar before requesting — sidebar only shows "Delivery available"

**Price Auto-Calculation**
- Google Maps Distance Matrix API (road distance) called server-side via `GOOGLE_MAPS_API_KEY`
- Informational only — no platform payment
- Live preview on the delivery request form while buyer types postcode
- Rounded to nearest pound (£67.30 → £67)
- `distanceMiles` and `estimatedCostGbp` stored on `DeliveryRequest` record at submission time and never change retroactively

**Buyer Delivery Request Flow**
- Prerequisite: buyer must have at least one offer on that listing (any status)
- Entry point: inline in the offer card/thread on `buyer/offers/page.tsx` — not a standalone sidebar CTA
- Form fields: full address (street, city, postcode) + optional notes
- Unlimited concurrent delivery requests across different listings
- Seller has 48h to accept or decline
- Buyer can re-request after decline or expiry
- Buyer can cancel a pending request before seller responds
- If listing is sold/archived while request is PENDING → auto-cancel + buyer notification

**Notifications**
- Seller (new request): in-app + email with postcode and estimated cost
- Buyer (accept): in-app + email with chat CTA
- Buyer (decline): in-app + email with re-request suggestion
- Buyer (48h expiry): in-app + email; seller is NOT notified on expiry

**Delivery Status and Lifecycle**
- States: `PENDING` → `ACCEPTED` / `DECLINED` → `COMPLETED`
- `COMPLETED` triggered by buyer "Mark as received" action in dashboard
- Post-accept coordination via existing chat thread; no new scheduling system
- Both seller and buyer dashboards show delivery status tag on the offer card; no separate Deliveries nav section

### Claude's Discretion
- Exact Prisma schema field names for `DeliveryRequest` model
- Whether to lazy-check 48h expiry on load or via a cron job
- Google Maps Distance Matrix API call: whether to call from backend (server-side) or Next.js API route
- Animation / transition for out-of-radius greyed state

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase 15 scope
</user_constraints>

---

## Summary

Phase 15 is a medium-complexity backend-first feature. The data model is well-understood from the CONTEXT.md: two Prisma additions (`DeliveryRequest` model + three new fields on `Listing`), a new `delivery` NestJS module with five REST endpoints, and a cron task for 48h expiry. The Google Maps Distance Matrix API is called server-side, which keeps the API key off the browser and follows the established `GOOGLE_MAPS_API_KEY` env-var pattern (same as `STRIPE_SECRET_KEY`). All four notification events reuse the existing `NotificationsService.create()` + `EmailService` pattern with zero new infrastructure.

Frontend work spans three surfaces: the `ListingWizard` (seller delivery options section), `buyer/offers/page.tsx` (inline delivery request form + status tags), and `search/page.tsx` + `CarCard.tsx` (delivery filter + badge). The dependency chain is strictly: schema → Prisma migration → backend module → seller wizard UI → buyer offers UI → search/filter/card UI → dashboards.

The most significant discretion-area call is **lazy expiry on read** rather than a dedicated cron job. The pattern is already proven in `offers.service.ts` (lines 274–281 and 598–607): the expiry check happens inside the service method at read/action time rather than via a scheduled job. This eliminates the need to add another cron entry and matches the team's established pattern. A lightweight daily cron sweep for truly stale PENDING records (as a safety net) is still worth adding to `tasks/` following `featured-boost-expiry.service.ts`.

**Primary recommendation:** Backend-first TDD approach (Wave 0 stubs → Wave 1 schema+backend → Wave 2 frontend) following the Phase 12/14 pattern already established in this codebase.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/schedule` | `^6.1.1` (already installed) | `@Cron` decorator for delivery expiry sweep | Already in `backend/package.json`, used in `AuctionLifecycleService` |
| `axios` | `^1.13.5` (already installed) | HTTP call to Google Maps Distance Matrix API from backend service | Already in backend `package.json`; preferred over `node-fetch` in NestJS context |
| `@prisma/client` | current project version | `DeliveryRequest` model, Listing field additions | Prisma is the established ORM |
| `@nestjs/axios` | `^4.0.1` (already installed) | `HttpModule` + `HttpService` for injected HTTP in NestJS | Already used in project; cleaner DI than raw axios |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `postcodes.io` (free API) | N/A — no npm package | Geocode buyer's delivery postcode to lat/lng for the frontend live preview | Call from a Next.js API route (`/api/geocode-postcode`) so buyer postcode is geocoded without exposing Google Maps key; then send the resulting lat/lng to the backend with the delivery request form submission OR compute on frontend and send with form — postcode → lat/lng is handled by `LocationContext.tsx` already using `api.postcodes.io` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Google Maps Distance Matrix | Haversine (straight-line) | Rejected per CONTEXT.md: road distance required for accurate delivery pricing |
| Lazy expiry on read | Full cron job | Cron adds operational overhead; lazy is simpler and matches existing `offers.service.ts` pattern. A daily safety-net cron sweep is still recommended |
| Next.js API route for Maps call | Backend NestJS service | Backend is better: API key never reaches browser; consistent with `STRIPE_SECRET_KEY` pattern |

**Installation:**
```bash
# Nothing new to install — @nestjs/schedule, @nestjs/axios, axios are all already in backend/package.json
# No frontend dependencies needed
```

---

## Architecture Patterns

### Recommended Project Structure

```
backend/src/
├── delivery/                    # NEW module
│   ├── delivery.module.ts
│   ├── delivery.controller.ts
│   ├── delivery.service.ts
│   ├── delivery-expiry.service.ts   # daily cron sweep
│   └── dto/
│       ├── create-delivery-request.dto.ts
│       └── respond-delivery-request.dto.ts
└── tasks/
    └── (delivery-expiry registered in TasksModule)

backend/prisma/
└── schema.prisma               # DeliveryRequest model + Listing delivery fields

src/                             # Next.js frontend
├── app/
│   ├── dashboard/
│   │   └── buyer/
│   │       └── offers/
│   │           └── page.tsx    # Add delivery request inline UI
│   └── api/
│       └── delivery-distance/
│           └── route.ts        # Next.js API route: postcode → Google Maps distance → cost preview
├── components/
│   ├── features/
│   │   └── CarCard.tsx         # Add deliveryAvailable prop + chip
│   └── listing/
│       └── ListingWizard.tsx   # Add Delivery Options section in Step 1 or Step 3
└── lib/
    └── deliveryApi.ts          # New API client functions for delivery endpoints
```

### Pattern 1: DeliveryRequest Prisma Model

**What:** New model relating `Offer` + `Listing` + buyer/seller `User`, storing address as JSON, distance in miles, cost in Decimal.

**When to use:** Any time you need to persist a delivery request with full audit trail.

**Recommended field names (Claude's discretion):**

```typescript
// Source: Prisma schema conventions from existing schema.prisma
enum DeliveryStatus {
  PENDING
  ACCEPTED
  DECLINED
  COMPLETED
  CANCELLED   // auto-cancel on listing archived / buyer-initiated

  @@map("delivery_status")
}

model DeliveryRequest {
  id                String         @id @default(uuid())
  listingId         String
  offerId           String         // FK to the qualifying offer
  buyerId           String
  sellerId          String
  // Address stored as JSON: { street: string, city: string, postcode: string }
  deliveryAddress   Json
  deliveryNotes     String?
  distanceMiles     Float
  estimatedCostGbp  Decimal        @db.Decimal(10, 2)
  status            DeliveryStatus @default(PENDING)
  expiresAt         DateTime       // created_at + 48h
  acceptedAt        DateTime?
  declinedAt        DateTime?
  cancelledAt       DateTime?
  completedAt       DateTime?
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  listing  Listing @relation(fields: [listingId], references: [id], onDelete: Cascade)
  offer    Offer   @relation(fields: [offerId], references: [id], onDelete: Cascade)
  buyer    User    @relation("DeliveryBuyer", fields: [buyerId], references: [id])
  seller   User    @relation("DeliverySeller", fields: [sellerId], references: [id])

  @@index([listingId])
  @@index([buyerId])
  @@index([sellerId])
  @@index([status])
  @@index([expiresAt])
  @@map("delivery_requests")
}
```

**New Listing fields:**
```prisma
// Add to model Listing in schema.prisma
deliveryAvailable       Boolean   @default(false)
deliveryPricePerMile    Decimal?  @db.Decimal(10, 2)
deliveryMaxMiles        Int?      // null = no radius limit (UK-wide)
```

**New Offer relation (add to model Offer):**
```prisma
deliveryRequests  DeliveryRequest[]
```

**New User relations (add to model User):**
```prisma
deliveryRequestsAsBuyer   DeliveryRequest[]  @relation("DeliveryBuyer")
deliveryRequestsAsSeller  DeliveryRequest[]  @relation("DeliverySeller")
```

### Pattern 2: Google Maps Distance Matrix API (server-side)

**What:** Backend service call to calculate road distance between seller's lat/lng and buyer's delivery postcode.

**When to use:** On `POST /delivery-requests` (request creation) to compute and store permanent distance + cost.

**Also:** A separate Next.js API route (`/api/delivery-distance`) returns the distance+cost for the live preview on the buyer's request form, called client-side as the buyer types their postcode.

```typescript
// Source: Google Maps Distance Matrix API documentation
// backend/src/delivery/delivery.service.ts

private async getRoadDistanceMiles(
  originLat: number,
  originLng: number,
  destinationPostcode: string,
): Promise<number> {
  const apiKey = this.config.get<string>('GOOGLE_MAPS_API_KEY');
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${originLat},${originLng}` +
    `&destinations=${encodeURIComponent(destinationPostcode)}` +
    `&units=imperial` +  // returns miles
    `&key=${apiKey}`;

  const { data } = await this.httpService.axiosRef.get(url);

  const element = data?.rows?.[0]?.elements?.[0];
  if (element?.status !== 'OK') {
    throw new BadRequestException(
      'Could not calculate road distance to that postcode. Please check the address.',
    );
  }
  // distance.value is in metres; convert to miles
  const metres = element.distance.value;
  return metres / 1609.344;
}
```

**For the live preview Next.js API route:**
```typescript
// src/app/api/delivery-distance/route.ts
// Calls Google Maps Distance Matrix server-side in Next.js
// Accepts: { originLat, originLng, destinationPostcode, pricePerMile }
// Returns: { distanceMiles: number, estimatedCostGbp: number }
```

### Pattern 3: 48h Expiry (Lazy + Safety Cron)

**What:** Two-part expiry strategy.

1. **Lazy check on read** — the established pattern in `offers.service.ts` (lines 274–281):
```typescript
// Source: backend/src/offers/offers.service.ts lines 273-281
if (
  request.expiresAt < new Date() &&
  request.status === 'PENDING'
) {
  await this.prisma.deliveryRequest.update({
    where: { id: requestId },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });
  // notify buyer
  throw new BadRequestException('This delivery request has expired.');
}
```

2. **Daily safety-net cron** — follows `FeaturedBoostExpiryService` pattern:
```typescript
// Source: backend/src/tasks/featured-boost-expiry.service.ts
@Cron('0 3 * * *')   // 3 AM daily UTC
async handleDeliveryExpiry(): Promise<void> {
  const expired = await this.prisma.deliveryRequest.findMany({
    where: { status: 'PENDING', expiresAt: { lte: new Date() } },
    include: { listing: { select: { title: true } }, buyer: { select: { id: true } } },
  });
  for (const req of expired) {
    await this.prisma.deliveryRequest.update({
      where: { id: req.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await this.notificationsService.create({ /* buyer expiry notification */ });
  }
}
```

### Pattern 4: Delivery Notification (reusing established pattern)

**What:** `NotificationsService.create()` for in-app + `EmailService` for email, exactly as in `offers.service.ts`.

```typescript
// Source: backend/src/offers/offers.service.ts lines 130-155 (established pattern)
await this.notificationsService.create({
  userId: listing.sellerId,
  type: 'DELIVERY_REQUESTED',
  title: 'Delivery Request Received',
  message: `A buyer has requested delivery of your ${listing.title} to ${postcode}. Estimated cost: £${cost}. Accept or decline within 48 hours.`,
  link: '/dashboard/seller/offers',
  entityType: 'DELIVERY_REQUEST',
  entityId: deliveryRequest.id,
  actionType: 'CREATED',
  data: { listingId, deliveryRequestId: deliveryRequest.id },
});
```

### Pattern 5: Inline Delivery Action in Buyer Offers Page

**What:** The "Add delivery request" action appears inside each offer row in `buyer/offers/page.tsx`. After submission, the action is replaced by a status badge. After a decline, the action re-appears.

**Entry point determination:** Show the delivery CTA if and only if:
1. `listing.deliveryAvailable === true`, AND
2. The offer row's offer exists (any status — the backend validates the offer FK), AND
3. The listing does NOT already have an active `PENDING` or `ACCEPTED` delivery request from this buyer

**Status badge variants (mirrors offer status badge pattern):**
```
PENDING   → amber pill: "Delivery Requested · Awaiting confirmation"
ACCEPTED  → green pill:  "Delivery Confirmed"
DECLINED  → red pill + re-show CTA
CANCELLED → grey pill + re-show CTA
COMPLETED → green pill:  "Delivered"
```

### Anti-Patterns to Avoid

- **Calling Google Maps API from the browser:** Never expose `GOOGLE_MAPS_API_KEY` to the frontend directly. Route all Maps calls through the backend or a Next.js API route.
- **Duplicate delivery requests without guard:** The backend must check for an existing `PENDING` or `ACCEPTED` delivery request for the same `listingId + buyerId` pair before creating a new one (allow only if prior is `DECLINED` or `CANCELLED`).
- **Forgetting the `offerId` FK requirement:** The backend must verify the buyer has at least one offer (any status) on the listing before creating a delivery request. The `offerId` FK captures the most recent offer.
- **Computing distance on the frontend:** Distance must be computed and stored server-side at submission time so the `distanceMiles` field is immutable. The frontend live preview is just for UX; the authoritative value is persisted on the `DeliveryRequest` record.
- **Radius check against GPS location:** Confirmed that radius is checked against the buyer's delivery address (entered in the request form), not their `LocationContext` GPS position.
- **Modifying `estimatedCostGbp` after submission:** The cost is locked at submission time even if the seller later updates `deliveryPricePerMile`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Road distance calculation | Haversine maths | Google Maps Distance Matrix API | Straight-line distance is unreliable for delivery pricing (road networks); Maps API returns accurate driving distance |
| Postcode → lat/lng | Custom geocoder | `api.postcodes.io` (already used in `LocationContext.tsx`) | Free, UK-specific, zero setup; already proven in codebase |
| HTTP client in NestJS | Raw `fetch()` or `require('http')` | `HttpModule` from `@nestjs/axios` | DI-friendly, testable, already installed |
| Notification delivery | Custom push system | `NotificationsService.create()` (already exists) | Handles in-app socket + Expo push in one call |
| Scheduled cleanup | Custom timer loop | `@Cron` from `@nestjs/schedule` (already installed + used) | Proven in `AuctionLifecycleService`; avoids memory leaks |
| Status expiry logic | Frontend countdown | Lazy server-side check at action time | Prevents race conditions; matches existing `offers.service.ts` pattern |

**Key insight:** Every infrastructure component needed for Phase 15 already exists in the project. No new npm packages required.

---

## Common Pitfalls

### Pitfall 1: Google Maps API Key Not Set on Fly.io
**What goes wrong:** The delivery request endpoint returns 500 or "Could not calculate road distance" for all requests in production.
**Why it happens:** `GOOGLE_MAPS_API_KEY` env var is only set in `.env` locally but not in the Fly.io secret store.
**How to avoid:** Add `fly secrets set GOOGLE_MAPS_API_KEY=...` to the deployment checklist as part of Wave 1 (backend). The backend service should throw a clear `InternalServerErrorException` with a descriptive message if the key is absent rather than crashing silently.
**Warning signs:** All delivery requests fail in staging/production but work locally.

### Pitfall 2: Google Maps "ZERO_RESULTS" on Invalid Postcode
**What goes wrong:** A buyer enters a malformed or non-existent UK postcode. The Maps API returns `element.status = 'ZERO_RESULTS'`. If not handled, the service crashes with a `TypeError: Cannot read properties of undefined`.
**Why it happens:** The `elements[0].status` check is skipped or not defensive enough.
**How to avoid:** Always check `element?.status !== 'OK'` and throw `BadRequestException('Could not calculate road distance to that postcode.')`. The live preview route should also handle this gracefully — show "Enter a valid UK postcode" rather than a broken cost estimate.
**Warning signs:** Manual test with postcode `"INVALID"` causes 500 instead of 400.

### Pitfall 3: Missing Offer Relation on `Offer` Model
**What goes wrong:** Prisma relation errors at migration or query time: "Unknown field `deliveryRequests` on model `Offer`".
**Why it happens:** The `deliveryRequests DeliveryRequest[]` back-relation is added to `DeliveryRequest` but the forward relation line is forgotten on `model Offer`.
**How to avoid:** Always add both sides of a Prisma relation in the same migration. The `Offer` model needs `deliveryRequests DeliveryRequest[]` and both `User` models need their named relations.
**Warning signs:** `prisma generate` succeeds but `prisma db push` or `prisma migrate dev` fails with relation errors.

### Pitfall 4: `ListingFilterDto` Not Extended for `deliveryAvailable`
**What goes wrong:** The search filter toggle sends `?deliveryAvailable=true` in the query string but the backend ignores it — no `WHERE deliveryAvailable = true` applied.
**Why it happens:** `ListingFilterDto` and `ListingsService.findAll()` (or equivalent) are not updated.
**How to avoid:** Add `@IsBoolean() @IsOptional() deliveryAvailable?: boolean` to `ListingFilterDto` with the `@Transform` boolean coercion that already exists for `ulezCompliant` (lines 159-162 in `listing-filter.dto.ts`). Then add the corresponding `WHERE` clause in `listings.service.ts`.
**Warning signs:** Search filter toggle renders in the UI but has no effect on results.

### Pitfall 5: Duplicate Delivery Requests
**What goes wrong:** A buyer submits multiple requests on the same listing if they click the button twice before the first request completes.
**Why it happens:** No server-side idempotency check.
**How to avoid:** Add a `@@unique([listingId, buyerId])` constraint — but this would prevent re-requests after decline. Instead, check at the service level: `findFirst({ where: { listingId, buyerId, status: { in: ['PENDING', 'ACCEPTED'] } } })` and throw `BadRequestException('You already have an active delivery request for this listing.')`.
**Warning signs:** Multiple PENDING requests appear for the same buyer-listing pair.

### Pitfall 6: Forgetting `deliveryAvailable` in Listing API Response Shape
**What goes wrong:** `CarCard.tsx` and `buyer/offers/page.tsx` receive the listing without `deliveryAvailable`, so the delivery badge and CTA never appear.
**Why it happens:** `listingApi.ts`'s `Listing` interface and the backend's `SELECT` projections don't include the new field.
**How to avoid:** Update `Listing` interface in `listingApi.ts` with `deliveryAvailable?: boolean`, `deliveryPricePerMile?: number | null`, `deliveryMaxMiles?: number | null`. Also update `getMyOffers()` in `OffersService` to include these fields in the listing select.
**Warning signs:** TypeScript shows no error (fields are optional) but delivery badge never renders.

### Pitfall 7: Radius Check Timing
**What goes wrong:** The out-of-radius greyed state on the sidebar is shown based on the buyer's GPS position (from `LocationContext`) rather than the delivery address they enter in the request form.
**Why it happens:** Developer uses `LocationContext.location.lat/lng` + Haversine against `listing.latitude/longitude` to decide radius eligibility.
**How to avoid:** The sidebar only shows "Delivery available" or "Delivery not available to your location". The greyed state is determined by calling `/api/delivery-distance` with the buyer's GPS postcode and the listing's price-per-mile/max-radius, BUT the authoritative check for the delivery request itself must use the address entered in the form. The sidebar is a hint, not a gate.

---

## Code Examples

### Backend: Delivery Module Structure

```typescript
// Source: established NestJS module pattern from backend/src/offers/offers.module.ts
// backend/src/delivery/delivery.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, NotificationsModule, EmailModule, ConfigModule, HttpModule],
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
```

### Backend: Five REST Endpoints

```typescript
// backend/src/delivery/delivery.controller.ts
@Controller('delivery-requests')
@UseGuards(SessionAuthGuard)
export class DeliveryController {
  // Buyer creates delivery request
  @Post()
  create(@Body() dto: CreateDeliveryRequestDto, @CurrentUser() user): Promise<...>

  // Seller accepts
  @Patch(':id/accept')
  accept(@Param('id') id: string, @CurrentUser() user): Promise<...>

  // Seller declines
  @Patch(':id/decline')
  decline(@Param('id') id: string, @CurrentUser() user): Promise<...>

  // Buyer cancels (PENDING only)
  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user): Promise<...>

  // Buyer marks as delivered (ACCEPTED → COMPLETED)
  @Patch(':id/complete')
  complete(@Param('id') id: string, @CurrentUser() user): Promise<...>

  // Get all delivery requests for a buyer (to hydrate offer cards)
  @Get('my')
  getMyRequests(@CurrentUser() user): Promise<...>

  // Get all delivery requests for a seller's listings
  @Get('received')
  getReceivedRequests(@CurrentUser() user): Promise<...>
}
```

### Frontend: Live Cost Preview (Next.js API Route)

```typescript
// Source: postcodes.io pattern from src/context/LocationContext.tsx
// src/app/api/delivery-distance/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const originLat = searchParams.get('originLat');
  const originLng = searchParams.get('originLng');
  const postcode = searchParams.get('postcode');
  const pricePerMile = parseFloat(searchParams.get('pricePerMile') || '0');

  const mapsUrl = `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${originLat},${originLng}` +
    `&destinations=${encodeURIComponent(postcode ?? '')}` +
    `&units=imperial&key=${process.env.GOOGLE_MAPS_API_KEY}`;

  const res = await fetch(mapsUrl);
  const data = await res.json();
  const element = data?.rows?.[0]?.elements?.[0];

  if (element?.status !== 'OK') {
    return NextResponse.json({ error: 'invalid_postcode' }, { status: 400 });
  }

  const distanceMiles = element.distance.value / 1609.344;
  const estimatedCostGbp = Math.round(distanceMiles * pricePerMile);

  return NextResponse.json({ distanceMiles: Math.round(distanceMiles * 10) / 10, estimatedCostGbp });
}
```

### Frontend: Delivery Chip on CarCard

```typescript
// Add to CarCardProps interface:
deliveryAvailable?: boolean

// Add to CarCard render (alongside existing chips for fuel/mileage):
{deliveryAvailable && (
  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold
    bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
    <Truck size={11} /> Delivery
  </span>
)}
```

### Frontend: Inline Delivery CTA in Buyer Offers Page

The delivery CTA and status tag are added as a new row/section below each offer row in `buyer/offers/page.tsx`. Logic:

```typescript
// Per offer row, also fetch deliveryRequests where buyerId=me and listingId=offer.listingId
// (fetched once via GET /delivery-requests/my and keyed by listingId)

const deliveryRequest = myDeliveryRequests.find(r => r.listingId === offer.listing?.id)
const showDeliveryCTA = (
  offer.listing?.deliveryAvailable &&
  !deliveryRequest  // no active request
) || deliveryRequest?.status === 'DECLINED' || deliveryRequest?.status === 'CANCELLED'

// Status badge or CTA renders inside the offer row
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Frontend haversine distance (Phase 11) | Server-side Google Maps road distance (Phase 15) | Phase 15 | More accurate for delivery pricing; requires GOOGLE_MAPS_API_KEY |
| No delivery support on listings | Per-listing delivery toggle + price-per-mile + optional radius | Phase 15 | Sellers can opt in without affecting other sellers' UX |

**Deprecated/outdated:**
- `PurchaseStatus.DELIVERY_REQUESTED` enum value on the `Sale` model (lines 237-239 of schema.prisma) — this is a different concept (dealer post-sale pipeline). Do NOT repurpose it for the new delivery system. The new `DeliveryStatus` enum is distinct.

---

## Open Questions

1. **Who provides the seller's `lat/lng` origin for the Maps API call?**
   - What we know: `Listing` model has `latitude Float?` / `longitude Float?` (set via `geocodeLocation()` in `listings.service.ts` when listing is created from the seller's `location` string via Nominatim).
   - What's unclear: If a listing has `latitude = null` (seller didn't set location or geocoding failed), the Maps API call cannot be made.
   - Recommendation: When `listing.latitude` is null, throw `BadRequestException('The seller has not set a location for this listing. Delivery distance cannot be calculated.')`. The seller UI should encourage setting a location when delivery is enabled.

2. **`offerId` FK: which offer when buyer has multiple?**
   - What we know: The prerequisite is "at least one offer, any status". The CONTEXT.md references `offerId` as a FK.
   - What's unclear: If a buyer has multiple offers on the same listing (WITHDRAWN + new PENDING), which `offerId` to attach.
   - Recommendation: Use the most recent offer (`ORDER BY createdAt DESC LIMIT 1`). The FK is audit trail only — the system does not use `offerId` to gate the delivery request flow beyond the prerequisite check.

3. **`estimatedCostGbp` when seller has no `deliveryPricePerMile` set?**
   - What we know: `deliveryPricePerMile` is nullable (optional per CONTEXT.md — "free-entry field").
   - What's unclear: If a seller enables delivery but leaves price-per-mile blank, what cost should be shown?
   - Recommendation: Treat blank `deliveryPricePerMile` as "seller will discuss cost directly" — show "Delivery available · Cost TBD" rather than a calculated figure. Backend stores `estimatedCostGbp = 0` and `distanceMiles` is still computed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (NestJS `@nestjs/testing`), established in `backend/src/offers/offers.service.spec.ts` |
| Config file | `backend/jest.config.js` (inferred from NestJS CLI defaults) |
| Quick run command | `cd backend && npx jest delivery.service.spec.ts --no-coverage` |
| Full suite command | `cd backend && npx jest --no-coverage` |

### Phase Requirements → Test Map

| Behaviour | Test Type | Automated Command | Notes |
|-----------|-----------|-------------------|-------|
| `createDeliveryRequest` rejects if buyer has no offer on listing | unit | `npx jest delivery.service.spec.ts -t "rejects if buyer has no offer"` | Wave 0 stub |
| `createDeliveryRequest` rejects if PENDING/ACCEPTED request already exists | unit | `npx jest delivery.service.spec.ts -t "rejects duplicate active request"` | Wave 0 stub |
| `createDeliveryRequest` rejects if buyer is outside seller's `deliveryMaxMiles` | unit | `npx jest delivery.service.spec.ts -t "rejects out-of-radius request"` | Wave 0 stub |
| `createDeliveryRequest` stores `distanceMiles` and `estimatedCostGbp` at submission | unit | `npx jest delivery.service.spec.ts -t "stores distance and cost"` | Wave 0 stub |
| `acceptDeliveryRequest` throws `ForbiddenException` if caller is not the seller | unit | `npx jest delivery.service.spec.ts -t "accept forbidden for non-seller"` | Wave 0 stub |
| `declineDeliveryRequest` sets status DECLINED and sends buyer notification | unit | `npx jest delivery.service.spec.ts -t "decline sends buyer notification"` | Wave 0 stub |
| `cancelDeliveryRequest` rejects if status is not PENDING | unit | `npx jest delivery.service.spec.ts -t "cancel rejects non-PENDING"` | Wave 0 stub |
| `completeDeliveryRequest` rejects if status is not ACCEPTED | unit | `npx jest delivery.service.spec.ts -t "complete rejects non-ACCEPTED"` | Wave 0 stub |
| Expiry sweep cancels PENDING requests past `expiresAt` | unit | `npx jest delivery-expiry.service.spec.ts -t "expires PENDING past expiresAt"` | Wave 0 stub |
| `ListingFilterDto.deliveryAvailable` applies WHERE clause in listings query | unit | `npx jest listings.service.spec.ts -t "deliveryAvailable filter"` | Extend existing spec file |
| Seller delivery fields (`deliveryAvailable`, `deliveryPricePerMile`, `deliveryMaxMiles`) saved on listing create/update | manual | Check DB record after create listing with delivery section filled | Human verify |
| Live cost preview updates as buyer types postcode | manual | E2E browser test — type postcode in form, see cost update | Human verify |
| CarCard delivery badge visible in search results | manual | Create a delivery-enabled listing, search, check badge | Human verify |
| Seller receives in-app + email notification on new delivery request | manual | Submit delivery request, check notifications inbox and email | Human verify |
| 48h expiry: buyer receives notification when request auto-cancels | manual | Set `expiresAt` to past in DB directly; trigger cron or load page | Human verify |

### Sampling Rate
- **Per task commit:** `cd backend && npx jest delivery.service.spec.ts --no-coverage`
- **Per wave merge:** `cd backend && npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/delivery/delivery.service.spec.ts` — 8 unit test stubs for all service guards
- [ ] `backend/src/delivery/delivery-expiry.service.spec.ts` — 1 unit test stub for expiry sweep
- [ ] `DeliveryModule` registered in `AppModule` and `TasksModule` — no new npm installs needed
- [ ] `DeliveryStatus` enum + `DeliveryRequest` model in `schema.prisma` — migration needed before any backend code runs

*(No new test framework setup needed — Jest is already configured for the backend.)*

---

## Sources

### Primary (HIGH confidence)
- Live project code: `backend/prisma/schema.prisma` — Listing model, Offer model, User model, existing enum patterns
- Live project code: `backend/src/notifications/notifications.service.ts` — notification + push pattern
- Live project code: `backend/src/tasks/auction-lifecycle.service.ts` — `@Cron` pattern
- Live project code: `backend/src/tasks/featured-boost-expiry.service.ts` — daily cron safety net pattern
- Live project code: `backend/src/offers/offers.service.ts` — lazy expiry check pattern (lines 274-281), notification pattern, email pattern
- Live project code: `backend/src/offers/offers.service.spec.ts` — Jest/NestJS unit test scaffold pattern
- Live project code: `backend/src/listings/dto/listing-filter.dto.ts` — filter DTO pattern with `@Transform` boolean coercion
- Live project code: `src/app/dashboard/buyer/offers/page.tsx` — offer card UI, status badge pattern
- Live project code: `src/context/LocationContext.tsx` — `api.postcodes.io` geocoding pattern
- Live project code: `src/components/features/CarCard.tsx` — chip/badge prop pattern

### Secondary (MEDIUM confidence)
- Google Maps Distance Matrix API: `https://maps.googleapis.com/maps/api/distancematrix/json?origins=LAT,LNG&destinations=POSTCODE&units=imperial&key=KEY` — standard endpoint confirmed via CONTEXT.md specification and general knowledge; specific `element.distance.value` in metres is the standard response field (MEDIUM — not verified against live API in this session)

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in `package.json`; no speculative installs
- Architecture: HIGH — patterns traced directly to existing service files in the codebase
- Pitfalls: HIGH — derived from reading actual code paths and DTO patterns in the project
- Google Maps response shape: MEDIUM — standard documented API; not live-tested in this session

**Research date:** 2026-06-21
**Valid until:** 2026-07-21 (stable — Maps API and NestJS schedule are mature; postcode.io is stable)
