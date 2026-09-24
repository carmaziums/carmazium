import { NextResponse } from "next/server";

const ROUTES = [
  "/auth/accept-invite/*",
  "/buy-cars/*",
  "/auctions/live/*",
  "/services/jobs/*",
  "/notifications*",
  "/messages*",
  "/settings*",
  "/dashboard/listings*",
  "/dashboard/auctions*",
  "/dashboard/offers*",
  "/dashboard/bids*",
  "/dashboard/earnings*",
];

export const dynamic = "force-dynamic";

export async function GET() {
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const bundleId = process.env.APPLE_BUNDLE_ID?.trim() || "uk.carmazium.app";

  if (!teamId) {
    return NextResponse.json(
      {
        configured: false,
        error: "APPLE_TEAM_ID is not configured for Universal Links.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appID: `${teamId}.${bundleId}`,
            paths: ROUTES,
          },
        ],
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    },
  );
}
