"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Car, Clock, Infinity, Loader2, Search, Ticket, Trash2 } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { getAdminUsers } from "@/lib/adminApi"

interface Grant {
    mode: 'ONE' | 'UNTIL' | 'FOREVER'
    expiresAt?: string
    grantedAt: string
    grantedBy: string
}

interface GrantDetail {
    id: string
    email: string
    firstName?: string | null
    lastName?: string | null
    role: string
    freeListingGrant: Grant | null
    freeListingGrantActive: boolean
}

function grantLabel(detail: GrantDetail | null) {
    const grant = detail?.freeListingGrant
    if (!grant) return 'No free-listing access'
    if (!detail?.freeListingGrantActive) return `Expired ${grant.expiresAt ? new Date(grant.expiresAt).toLocaleString('en-GB') : ''}`
    if (grant.mode === 'ONE') return '1 free retail listing remaining'
    if (grant.mode === 'FOREVER') return 'Free retail listings forever'
    return `Free retail listings until ${new Date(grant.expiresAt!).toLocaleString('en-GB')}`
}

export default function AdminFreeListingsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [searchInput, setSearchInput] = React.useState('')
    const [search, setSearch] = React.useState('')
    const [users, setUsers] = React.useState<any[]>([])
    const [selected, setSelected] = React.useState<GrantDetail | null>(null)
    const [loading, setLoading] = React.useState(false)
    const [acting, setActing] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [hours, setHours] = React.useState('6')
    const [days, setDays] = React.useState('7')

    React.useEffect(() => {
        if (!authLoading) {
            if (!user) { router.replace('/auth/login'); return }
            if (profile?.role !== 'ADMIN') { router.replace('/dashboard'); return }
        }
    }, [user, profile, authLoading, router])

    const loadUsers = React.useCallback(async () => {
        if (profile?.role !== 'ADMIN') return
        try {
            setLoading(true)
            setError(null)
            const result = await getAdminUsers(1, 50, search || undefined)
            setUsers(result.data || [])
        } catch (err: any) {
            setError(err.message || 'Failed to load users')
        } finally {
            setLoading(false)
        }
    }, [profile?.role, search])

    React.useEffect(() => { loadUsers() }, [loadUsers])

    const loadGrant = async (userId: string) => {
        try {
            setActing(true)
            setError(null)
            const result = await apiClient<{ data: GrantDetail }>(`/admin/free-listings/users/${userId}`)
            setSelected(result.data)
        } catch (err: any) {
            setError(err.message || 'Failed to load free-listing access')
        } finally {
            setActing(false)
        }
    }

    const applyGrant = async (body: Record<string, unknown>) => {
        if (!selected) return
        try {
            setActing(true)
            setError(null)
            const result = await apiClient<{ data: GrantDetail }>(`/admin/free-listings/users/${selected.id}`, {
                method: 'PATCH',
                body: JSON.stringify(body),
            })
            setSelected(result.data)
        } catch (err: any) {
            setError(err.message || 'Failed to update free-listing access')
        } finally {
            setActing(false)
        }
    }

    const revoke = async () => {
        if (!selected) return
        if (!window.confirm(`Revoke free-listing access for ${selected.email}?`)) return
        try {
            setActing(true)
            setError(null)
            const result = await apiClient<{ data: GrantDetail }>(`/admin/free-listings/users/${selected.id}`, {
                method: 'DELETE',
            })
            setSelected(result.data)
        } catch (err: any) {
            setError(err.message || 'Failed to revoke free-listing access')
        } finally {
            setActing(false)
        }
    }

    if (authLoading || (user && !profile)) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    }
    if (!user || profile?.role !== 'ADMIN') return null

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ''}` : (user.email?.split('@')[0] || 'Admin')

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />
                <main className="flex-1 space-y-6 min-w-0">
                    <div className="bg-[var(--bg-input)] p-6 rounded-2xl border border-[var(--border-default)]">
                        <Link href="/dashboard/admin" className="inline-flex items-center text-sm text-[var(--text-muted)] hover:text-primary mb-2">
                            <ArrowLeft size={16} className="mr-1" /> Back to Overview
                        </Link>
                        <div className="flex items-center gap-3">
                            <Ticket className="text-primary" size={28} />
                            <div>
                                <h1 className="text-3xl font-black font-heading uppercase tracking-tight">Free Listing Access</h1>
                                <p className="text-sm text-[var(--text-muted)]">Admin-only retail listing fee overrides. Normal review and listing rules still apply.</p>
                            </div>
                        </div>
                    </div>

                    {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300">{error}</div>}

                    <div className="grid lg:grid-cols-[1fr_1.1fr] gap-6">
                        <section className="glass-card border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl p-5">
                            <h2 className="font-black uppercase tracking-wider mb-4">Find registered user</h2>
                            <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()) }} className="flex gap-2 mb-4">
                                <div className="relative flex-1">
                                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                                    <input
                                        value={searchInput}
                                        onChange={e => setSearchInput(e.target.value)}
                                        placeholder="Name or email"
                                        className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                                    />
                                </div>
                                <button className="px-4 py-2 rounded-xl bg-primary text-white font-bold text-sm">Search</button>
                            </form>

                            {loading ? (
                                <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
                            ) : (
                                <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                                    {users.map((u) => (
                                        <button
                                            key={u.id}
                                            onClick={() => loadGrant(u.id)}
                                            className={`w-full text-left p-3 rounded-xl border transition-colors ${selected?.id === u.id ? 'border-primary bg-primary/10' : 'border-[var(--border-default)] bg-[var(--bg-input)] hover:border-primary/40'}`}
                                        >
                                            <div className="font-bold text-sm">{[u.firstName, u.lastName].filter(Boolean).join(' ') || 'Unnamed user'}</div>
                                            <div className="text-xs text-[var(--text-muted)] truncate">{u.email}</div>
                                            <div className="text-[10px] uppercase tracking-widest text-[var(--text-faint)] mt-1">{u.role}</div>
                                        </button>
                                    ))}
                                    {!users.length && <p className="text-sm text-[var(--text-muted)] py-8 text-center">No users found.</p>}
                                </div>
                            )}
                        </section>

                        <section className="glass-card border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl p-5">
                            {!selected ? (
                                <div className="min-h-[260px] flex flex-col items-center justify-center text-center text-[var(--text-muted)]">
                                    <Car size={36} className="mb-3 opacity-60" />
                                    <p className="font-bold">Select a user to manage free listing access.</p>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    <div>
                                        <p className="text-xs uppercase tracking-widest text-[var(--text-muted)]">Selected account</p>
                                        <h2 className="text-xl font-black">{[selected.firstName, selected.lastName].filter(Boolean).join(' ') || selected.email}</h2>
                                        <p className="text-sm text-[var(--text-muted)]">{selected.email} · {selected.role}</p>
                                    </div>

                                    <div className={`p-4 rounded-xl border ${selected.freeListingGrantActive ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-[var(--bg-input)] border-[var(--border-default)]'}`}>
                                        <p className="text-xs uppercase tracking-widest font-bold text-[var(--text-muted)] mb-1">Current access</p>
                                        <p className="font-bold">{grantLabel(selected)}</p>
                                        {selected.freeListingGrant?.grantedAt && (
                                            <p className="text-xs text-[var(--text-muted)] mt-1">Granted {new Date(selected.freeListingGrant.grantedAt).toLocaleString('en-GB')}</p>
                                        )}
                                    </div>

                                    <div className="grid sm:grid-cols-2 gap-3">
                                        <button disabled={acting} onClick={() => applyGrant({ mode: 'ONE' })} className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] hover:border-primary text-left disabled:opacity-50">
                                            <Ticket size={18} className="text-primary mb-2" />
                                            <p className="font-bold">1 Free Car</p>
                                            <p className="text-xs text-[var(--text-muted)]">Consumed only when this user successfully submits one paid-tier retail listing for review.</p>
                                        </button>
                                        <button disabled={acting} onClick={() => applyGrant({ mode: 'MONTH' })} className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] hover:border-primary text-left disabled:opacity-50">
                                            <Clock size={18} className="text-primary mb-2" />
                                            <p className="font-bold">1 Month Free</p>
                                            <p className="text-xs text-[var(--text-muted)]">Unlimited retail listings until the same calendar date next month.</p>
                                        </button>
                                    </div>

                                    <div className="grid sm:grid-cols-2 gap-3">
                                        <div className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)]">
                                            <p className="font-bold mb-2">Free for Hours</p>
                                            <div className="flex gap-2">
                                                <input type="number" min="1" max="744" value={hours} onChange={e => setHours(e.target.value)} className="w-24 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-lg px-3 py-2" />
                                                <button disabled={acting} onClick={() => applyGrant({ mode: 'HOURS', amount: Number(hours) })} className="flex-1 bg-primary text-white rounded-lg font-bold disabled:opacity-50">Apply</button>
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)]">
                                            <p className="font-bold mb-2">Free for Days</p>
                                            <div className="flex gap-2">
                                                <input type="number" min="1" max="365" value={days} onChange={e => setDays(e.target.value)} className="w-24 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-lg px-3 py-2" />
                                                <button disabled={acting} onClick={() => applyGrant({ mode: 'DAYS', amount: Number(days) })} className="flex-1 bg-primary text-white rounded-lg font-bold disabled:opacity-50">Apply</button>
                                            </div>
                                        </div>
                                    </div>

                                    <button disabled={acting} onClick={() => applyGrant({ mode: 'FOREVER' })} className="w-full p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 text-left disabled:opacity-50 flex items-center gap-3">
                                        <Infinity size={24} className="text-emerald-400" />
                                        <div>
                                            <p className="font-bold">Free Forever</p>
                                            <p className="text-xs text-[var(--text-muted)]">All paid-tier retail listings bypass the listing fee until an admin revokes access.</p>
                                        </div>
                                    </button>

                                    <button disabled={acting || !selected.freeListingGrant} onClick={revoke} className="w-full px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                                        {acting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Revoke Free Access
                                    </button>
                                </div>
                            )}
                        </section>
                    </div>
                </main>
            </div>
        </div>
    )
}
