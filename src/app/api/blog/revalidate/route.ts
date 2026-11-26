import { revalidatePath, revalidateTag } from 'next/cache'
import { serverBackendFetch } from '@/lib/serverBackendFetch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' }

// A fixed cache refresh, not a mutation proxy. The existing backend guard
// verifies the current identity and database admin role before invalidation.
// Accept no client-controlled paths, tags or upstream destinations.
export async function POST(request: Request): Promise<Response> {
    const authorization = request.headers.get('authorization')
    if (!authorization?.startsWith('Bearer ') || authorization.length > 8192) {
        return Response.json({ refreshed: false }, { status: 401, headers })
    }
    try {
        const check = await serverBackendFetch('/blog/admin/all?page=1&limit=1', {
            cache: 'no-store', headers: { Authorization: authorization },
        }, { timeoutMs: 4500, retries: 0 })
        if (!check.ok) {
            return Response.json({ refreshed: false }, {
                status: check.status === 401 || check.status === 403 ? check.status : 503, headers,
            })
        }
        const result = await check.json()
        if (result?.success !== true || !Array.isArray(result.data)) {
            return Response.json({ refreshed: false }, { status: 502, headers })
        }
        revalidateTag('public-blog', { expire: 0 })
        revalidatePath('/sitemap.xml')
        revalidatePath('/blog', 'layout')
        return Response.json({ refreshed: true }, { headers })
    } catch {
        return Response.json({ refreshed: false }, { status: 503, headers })
    }
}
