"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/context/AuthContext"
import { getWatchlist, removeFromWatchlist, formatPrice, type WatchlistItem } from "@/lib/listingApi"
import { Loader2, Heart, Trash2, Gavel, ChevronRight } from "lucide-react"

export default function SavedCarsPage() {
    const { user, loading: authLoading } = useAuth()
    const [items, setItems] = React.useState<WatchlistItem[]>([])
    const [loading, setLoading] = React.useState(true)
    const [removing, setRemoving] = React.useState<string | null>(null)
    const [page, setPage] = React.useState(1)
    const [totalPages, setTotalPages] = React.useState(1)
    const [loadError, setLoadError] = React.useState<string | null>(null)
    const [refreshKey, setRefreshKey] = React.useState(0)
    const activeUserIdRef = React.useRef<string | null>(null)
    const fetchEpochRef = React.useRef(0)
    const accountId = user?.id ?? null
    // Hide old items synchronously during an account change; effects run
    // after render and therefore cannot safely be the only privacy gate.
    const switchingAccounts = activeUserIdRef.current !== accountId

    React.useEffect(() => {
        if (activeUserIdRef.current !== accountId) {
            activeUserIdRef.current = accountId
            fetchEpochRef.current++
            setItems([])
            setTotalPages(1)
            setPage(1)
            setLoadError(null)
        }
        if (authLoading || !accountId) {
            setLoading(false)
            return
        }

        let cancelled = false
        const epoch = ++fetchEpochRef.current
        setLoading(true)
        setLoadError(null)

        void getWatchlist(page, 12).then(data => {
            if (cancelled || epoch !== fetchEpochRef.current ||
                activeUserIdRef.current !== accountId) return
            setItems(data.data || [])
            setTotalPages(data.pagination?.totalPages || 1)
        }).catch(err => {
            if (cancelled || epoch !== fetchEpochRef.current ||
                activeUserIdRef.current !== accountId) return
            console.error('Failed to fetch saved cars:', err)
            // Never mislabel HTTP failure as an account with zero cars.
            setLoadError('Could not refresh saved cars. Please try again.')
        }).finally(() => {
            if (!cancelled && epoch === fetchEpochRef.current &&
                activeUserIdRef.current === accountId) setLoading(false)
        })
        return () => {
            cancelled = true
            fetchEpochRef.current++
        }
    }, [accountId, authLoading, page, refreshKey])

    // If a car is saved in the native app, revisiting this website tab
    // refreshes directly from the shared backend, without a page reload.
    React.useEffect(() => {
        if (!accountId) return
        const refreshOnFocus = () => setRefreshKey(prev => prev + 1)
        const refreshOnVisible = () => {
            if (document.visibilityState === 'visible') refreshOnFocus()
        }
        window.addEventListener('focus', refreshOnFocus)
        document.addEventListener('visibilitychange', refreshOnVisible)
        return () => {
            window.removeEventListener('focus', refreshOnFocus)
            document.removeEventListener('visibilitychange', refreshOnVisible)
        }
    }, [accountId])

    const handleRemove = async (listingId: string) => {
        if (!accountId) return
        const removingAccount = accountId
        try {
            setRemoving(listingId)
            await removeFromWatchlist(listingId)
            if (activeUserIdRef.current !== removingAccount) return
            setItems(prev => prev.filter(item => item.listingId !== listingId))
            // Reconcile server count/pagination following a removal.
            if (items.length === 1 && page > 1) setPage(prev => prev - 1)
            else setRefreshKey(prev => prev + 1)
        } catch (err) {
            if (activeUserIdRef.current === removingAccount) {
                console.error('Failed to remove saved car:', err)
                setLoadError('Could not remove this car. Please retry.')
            }
        } finally {
            if (activeUserIdRef.current === removingAccount) setRemoving(null)
        }
    }

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="buyer" />
                <main className="flex-1 space-y-6">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-bold font-heading flex items-center gap-3">
                            <Heart className="text-pink-400" /> Saved Cars
                        </h1>
                    </div>

                    {loadError && !switchingAccounts && (
                        <div role="alert" className="glass-card mb-4 p-4 flex items-center justify-between gap-3">
                            <span>{loadError}</span>
                            <Button variant="outline" onClick={() => setRefreshKey(k => k + 1)}>
                                Retry
                            </Button>
                        </div>
                    )}

                    {loading || switchingAccounts ? (
                        <div className="glass-card p-12 text-center">
                            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                        </div>
                    ) : items.length === 0 ? (
                        loadError ? null : (
                            <div className="glass-card p-12 text-center text-[var(--text-muted)]">
                                Your Saved Cars list is empty. <Link href="/search" className="text-primary hover:underline">Browse cars to add some!</Link>
                            </div>
                        )
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {items.map((item) => (
                                    <div key={item.id} className="glass-card overflow-hidden group relative">
                                        <button
                                            onClick={() => handleRemove(item.listingId)}
                                            disabled={removing === item.listingId}
                                            className="absolute top-3 right-3 z-10 bg-[var(--bg-card)] p-2 rounded-full text-pink-400 hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50"
                                            title="Remove from saved cars"
                                        >
                                            {removing === item.listingId ? (
                                                <Loader2 size={18} className="animate-spin" />
                                            ) : (
                                                <Heart size={18} fill="currentColor" />
                                            )}
                                        </button>
                                        <Link href={`/buy-cars/${item.listing.slug}`}>
                                            <div className="relative h-48 w-full bg-[var(--bg-input)]">
                                                {item.listing.images?.[0] ? (
                                                    <Image
                                                        src={item.listing.images[0]}
                                                        alt={item.listing.title}
                                                        fill
                                                        sizes="(max-width: 768px) 90vw, 33vw"
                                                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[var(--text-secondary)]">No Image</div>
                                                )}
                                                <div className={`absolute bottom-3 left-3 px-2 py-1 rounded text-xs font-bold ${item.listing.status === 'ACTIVE' ? 'bg-emerald-500/80 text-white' :
                                                        item.listing.status === 'SOLD' ? 'bg-blue-500/80 text-white' :
                                                            'bg-gray-500/80 text-white'
                                                    }`}>
                                                    {item.listing.status}
                                                </div>
                                            </div>
                                            <div className="p-4">
                                                <h3 className="text-lg font-bold mb-1 truncate">{item.listing.title}</h3>
                                                <p className="text-xs text-[var(--text-muted)] mb-2">
                                                    {item.listing.year} • {item.listing.mileage?.toLocaleString() || 0} miles
                                                </p>
                                                <div className="flex justify-between items-end">
                                                    <p className="text-xl font-bold text-primary">{formatPrice(item.listing.price)}</p>
                                                    <span className="text-xs text-[var(--text-muted)]">{item.listing.viewCount} views</span>
                                                </div>
                                            </div>
                                        </Link>
                                        <div className="p-4 pt-0 grid gap-2">
                                            {item.listing.status === 'ACTIVE' && item.listing.type === 'CLASSIFIED' && item.listing.sellerId !== user?.id && (
                                                <Link href={`/buy-cars/${item.listing.slug}?makeOffer=true`}>
                                                    <Button className="w-full gap-2"><Gavel size={14} /> Make Offer</Button>
                                                </Link>
                                            )}
                                            <Link href={`/buy-cars/${item.listing.slug}`}>
                                                <Button variant="outline" className="w-full gap-2">View Listing <ChevronRight size={14} /></Button>
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {totalPages > 1 && (
                                <div className="flex justify-center gap-2 pt-6">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="px-4 py-2 rounded bg-[var(--bg-input)] disabled:opacity-50"
                                    >
                                        Previous
                                    </button>
                                    <span className="px-4 py-2 text-[var(--text-muted)]">Page {page} of {totalPages}</span>
                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                        className="px-4 py-2 rounded bg-[var(--bg-input)] disabled:opacity-50"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>
        </div>
    )
}
