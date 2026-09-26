import { redirect } from "next/navigation"

type SearchParams = Record<string, string | string[] | undefined>

export default async function LegacyBuyCarsPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>
}) {
    const params = await searchParams
    const seller = Array.isArray(params.seller) ? params.seller[0] : params.seller

    if (seller) {
        redirect(`/seller/${encodeURIComponent(seller)}/listings`)
    }

    const nextParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue
        if (Array.isArray(value)) {
            value.forEach((item) => nextParams.append(key, item))
        } else {
            nextParams.set(key, value)
        }
    }

    const query = nextParams.toString()
    redirect(query ? `/search?${query}` : "/search")
}
