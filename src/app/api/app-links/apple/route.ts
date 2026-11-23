const BUNDLE_ID = 'uk.carmazium.app';
const TEAM_ID_RE = /^[A-Z0-9]{10}$/;

const UNIVERSAL_LINK_PATHS = [
  '/auth/accept-invite*',
  '/buy-cars/*',
  '/auctions/live/*',
  '/auctions',
  '/auctions/',
  '/auctions/how-it-works',
  '/auctions/browse',
  '/services',
  '/services/',
  '/services/jobs',
  '/services/jobs/*',
  '/services/delivery',
  '/services/delivery/',
  '/services/delivery/new',
  '/services/delivery/new/',
  '/services/inspection',
  '/services/inspection/',
  '/services/inspection/new',
  '/services/inspection/new/',
  '/services/finance',
  '/services/finance/',
  '/finance',
  '/services/warranty',
  '/services/warranty/',
  '/services/warranty/terms',
  '/services/warranty/terms/',
  '/dashboard/service',
  '/dashboard/service/',
  '/dashboard/service/jobs',
  '/dashboard/service/jobs/*',
  '/dashboard/partner',
  '/dashboard/partner/',
  '/dashboard/warranties',
  '/become-a-partner',
  '/contact',
  '/notifications*',
  '/messages*',
  '/settings*',
  '/dashboard/listings*',
  '/dashboard/auctions*',
  '/dashboard/offers*',
  '/dashboard/bids*',
  '/dashboard/earnings*',
];

export async function GET() {
  const teamId = (process.env.APPLE_APP_TEAM_ID ?? '').trim().toUpperCase();

  if (!TEAM_ID_RE.test(teamId)) {
    return Response.json(
      { error: 'Apple universal-link association is not configured.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return Response.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appID: `${teamId}.${BUNDLE_ID}`,
            paths: UNIVERSAL_LINK_PATHS,
          },
        ],
      },
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    },
  );
}
