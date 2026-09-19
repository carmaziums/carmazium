type NextServerFetchInit = RequestInit & {
    next?: {
        revalidate?: number | false
        tags?: string[]
    }
}

const TRANSIENT_HTTP_STATUS = new Set([502, 503, 504])

function sleep(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms))
}

/**
 * Server-side fetch wrapper for calls from Next.js to the Fly backend.
 *
 * Normal requests keep Next's cache/revalidate semantics. Only after a
 * transient network failure or gateway response do we retry with no-store,
 * which avoids reusing a failed memoised request in the same render.
 */
export async function serverFetchWithRetry(
    input: string | URL,
    init: NextServerFetchInit = {},
    retries = 2,
): Promise<Response> {
    let lastResponse: Response | null = null
    let lastError: unknown = null

    try {
        const response = await fetch(input, init)
        if (!TRANSIENT_HTTP_STATUS.has(response.status)) return response
        lastResponse = response
    } catch (error) {
        lastError = error
    }

    const { next: _next, cache: _cache, ...fallbackInit } = init

    for (let attempt = 0; attempt < retries; attempt += 1) {
        await sleep(100 * (attempt + 1))

        try {
            const response = await fetch(input, {
                ...fallbackInit,
                cache: "no-store",
            })
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
