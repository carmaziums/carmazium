import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const originLat = searchParams.get('originLat');
  const originLng = searchParams.get('originLng');
  const postcode = searchParams.get('postcode');
  const pricePerMile = parseFloat(searchParams.get('pricePerMile') || '0');

  if (!originLat || !originLng || !postcode) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'service_error' }, { status: 503 });
  }

  const mapsUrl = `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${originLat},${originLng}` +
    `&destinations=${encodeURIComponent(postcode)}` +
    `&units=imperial&key=${apiKey}`;

  try {
    const res = await fetch(mapsUrl);
    const data = await res.json();
    const element = data?.rows?.[0]?.elements?.[0];

    if (element?.status !== 'OK') {
      return NextResponse.json({ error: 'invalid_postcode' }, { status: 400 });
    }

    // distance.value is always in metres regardless of units param
    const distanceMiles = element.distance.value / 1609.344;
    const estimatedCostGbp = pricePerMile > 0 ? Math.round(distanceMiles * pricePerMile) : 0;

    return NextResponse.json({
      distanceMiles: Math.round(distanceMiles * 10) / 10,
      estimatedCostGbp,
    });
  } catch {
    return NextResponse.json({ error: 'service_error' }, { status: 500 });
  }
}
