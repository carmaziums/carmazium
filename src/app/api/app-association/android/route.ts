import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME?.trim() || "uk.carmazium.app";
  const fingerprint = process.env.ANDROID_RELEASE_CERT_SHA256?.trim();

  if (!fingerprint) {
    return NextResponse.json(
      {
        configured: false,
        error: "ANDROID_RELEASE_CERT_SHA256 is not configured for Android App Links.",
      },
      { status: 503 },
    );
  }

  const fingerprints = fingerprint
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: packageName,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    },
  );
}
