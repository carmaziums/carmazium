import { fetchWithRetry } from '@/lib/fetchWithRetry';

// A single, fixed, read-only auth profile endpoint. The backend alone verifies
// the Supabase Bearer token and resolves all admin/dealer permissions.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Vary': 'Authorization',
};

export async function GET(request: Request): Promise<Response> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ') || authorization.length > 8192) {
    return Response.json({ message: 'Sign in required' }, { status: 401, headers });
  }

  // The destination is fixed server-side; never accept a client-supplied URL
  // or forward browser cookies or any other incoming headers.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev';
  const url = new URL('/users/me', apiUrl);

  try {
    const upstream = await fetchWithRetry(url.toString(), {
      method: 'GET',
      cache: 'no-store',
      headers: { Authorization: authorization, Accept: 'application/json' },
    }, {
      timeoutMs: 4500,
      retries: 2,
      retryDelayMs: 250,
    });

    if (upstream.status === 401 || upstream.status === 403) {
      return Response.json({ message: 'Account verification denied' }, {
        status: upstream.status, headers,
      });
    }
    if (!upstream.ok) {
      return Response.json({ message: 'Account server temporarily unavailable' }, {
        status: 503, headers,
      });
    }

    const profile = await upstream.json();
    if (profile?.success !== true || typeof profile?.data?.id !== 'string') {
      return Response.json({ message: 'Invalid account verification response' }, {
        status: 502, headers,
      });
    }

    return Response.json(profile, { status: 200, headers });
  } catch {
    // Do not expose transport traces, tokens, account fields, or Fly internals.
    return Response.json({ message: 'Account server temporarily unavailable' }, {
      status: 503, headers,
    });
  }
}
