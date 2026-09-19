const TRANSIENT_HTTP_STATUS = new Set([502, 503, 504])

function sleep(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms))
}

/**
 * Server-side fetch wrapper for calls from Next.js to the Fly backend.
 *
 * The first request keeps the route's normal revalidation cache. Only a
 * transient network failure or 502/503/504 uses short no-store retries,
 * preventing one temporary backend connection reset from becoming a false
 * 404/empty SSR response.
 */
export async function serverFetchWithRetry(
    input: string | URL,
    revalidateSeconds = 60,
    retries = 2,
): Promise<Response> {
    let lastResponse: Response | null = null
    let lastError: unknown = null

    try {
        const response = await fetch(input, {
            next: { revalidate: revalidateSeconds },
        })
        if (!TRANSIENT_HTTP_STATUS.has(response.status)) return response
        lastResponse = response
    } catch (error) {
        lastError = error
    }

    for (let attempt = 0; attempt < retries; attempt += 1) {
        await sleep(100 * (attempt + 1))

        try {
            const response = await fetch(input, { cache: "no-store" })
            if (!TRANSIENT_HTTP_STATUS.has(response.status)) return response
            lastResponse = response
        } catch (error) {
            lastError = error
        }
    }

    if (lastResponse) return lastResponse
    if (lastError instanceof Error) throw lastError
    throw new Error("Backend request failed after transient retries")
}
