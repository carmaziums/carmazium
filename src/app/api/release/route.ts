import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const releaseId =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_RELEASE_ID ||
    "unknown";

  return NextResponse.json({
    releaseId,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    service: "web",
  });
}
