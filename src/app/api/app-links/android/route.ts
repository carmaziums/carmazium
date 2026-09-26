const PACKAGE_NAME = 'uk.carmazium.app';
const FINGERPRINT_RE = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

function readFingerprints() {
  return (process.env.ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS ?? '')
    .split(/[;,\n]/)
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
}

export async function GET() {
  const fingerprints = readFingerprints();

  if (!fingerprints.length || fingerprints.some((value) => !FINGERPRINT_RE.test(value))) {
    return Response.json(
      { error: 'Android app-link signing association is not configured.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return Response.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: PACKAGE_NAME,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    },
  );
}
