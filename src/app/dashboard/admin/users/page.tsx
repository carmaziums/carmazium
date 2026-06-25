"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Users, Loader2, ArrowLeft, MoreHorizontal, ShieldAlert, BadgeCheck, Ban, LockKeyhole, LockKeyholeOpen, ShieldCheck, X, Landmark, CreditCard, AlertCircle, Search } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getAdminUsers, updateUserRole, banUser, unbanUser, lockUser, unlockUser } from "@/lib/adminApi"

export default function AdminUsersPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [users, setUsers] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [updating, setUpdating] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const [page, setPage] = React.useState(1)
    const [total, setTotal] = React.useState(0)
    const [openMenu, setOpenMenu] = React.useState<string | null>(null)
    const [search, setSearch] = React.useState("")
    const [searchInput, setSearchInput] = React.useState("")
    const menuRef = React.useRef<HTMLDivElement>(null)
    const limit = 20

    React.useEffect(() => {
        if (!authLoading) {
            if (!user) { router.replace('/auth/login'); return }
            if (profile?.role !== 'ADMIN') { router.replace('/dashboard'); return }
        }
    }, [user, profile, authLoading, router])

    const fetchUsers = async () => {
        try {
            setLoading(true)
            setError(null)
            const result = await getAdminUsers(page, limit, search || undefined)
            setUsers(result.data || [])
            // Backend returns PaginatedResponse: { data, pagination: { total, ... } }
            setTotal(result.pagination?.total ?? 0)
        } catch (err: any) {
            setError(err.message || "Failed to load system users.")
        } finally {
            setLoading(false)
        }
    }

    React.useEffect(() => {
        if (profile?.role === 'ADMIN') fetchUsers()
    }, [profile, page, search])

    // Close dropdown on outside click
    React.useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenu(null)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    const handleRoleChange = async (userId: string, newRole: string) => {
        try {
            setUpdating(userId)
            await updateUserRole(userId, newRole)
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
        } catch (err: any) {
            alert(err.message || 'Failed to update user role')
        } finally {
            setUpdating(null)
        }
    }

    const handleUserAction = async (userId: string, action: 'ban' | 'unban' | 'lock' | 'unlock') => {
        setOpenMenu(null)
        try {
            setUpdating(userId)
            if (action === 'ban') {
                await banUser(userId)
                setUsers(prev => prev.map(u => u.id === userId ? { ...u, deletedAt: new Date().toISOString() } : u))
            } else if (action === 'unban') {
                await unbanUser(userId)
                setUsers(prev => prev.map(u => u.id === userId ? { ...u, deletedAt: null } : u))
            } else if (action === 'lock') {
                await lockUser(userId)
                setUsers(prev => prev.map(u => u.id === userId ? { ...u, lockoutUntil: new Date(Date.now() + 86400000).toISOString() } : u))
            } else if (action === 'unlock') {
                await unlockUser(userId)
                setUsers(prev => prev.map(u => u.id === userId ? { ...u, lockoutUntil: null } : u))
            }
        } catch (err: any) {
            alert(err.message || `Failed to ${action} user`)
        } finally {
            setUpdating(null)
        }
    }

    if (authLoading || (user && !profile) || (loading && users.length === 0)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    if (!user || profile?.role !== 'ADMIN') return null

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "Admin")

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />

                <main className="flex-1 space-y-8 min-w-0">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800/50 p-6 rounded-2xl border border-white/10 backdrop-blur-md">
                        <div>
                            <Link href="/dashboard/admin" className="inline-flex items-center text-gray-400 hover:text-white mb-2 text-sm transition-colors">
                                <ArrowLeft size={16} className="mr-1" /> Back to Overview
                            </Link>
                            <h1 className="text-3xl font-black font-heading text-white uppercase tracking-tight flex items-center gap-3">
                                <Users className="text-blue-400 hidden sm:block" size={28} />
                                Account Management
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">{total.toLocaleString()} total users</p>
                        </div>

                        {/* Search */}
                        <form
                            onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(searchInput.trim()) }}
                            className="flex items-center gap-2 w-full sm:w-auto"
                        >
                            <div className="relative flex-1 sm:w-64">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Search name or email…"
                                    value={searchInput}
                                    onChange={e => setSearchInput(e.target.value)}
                                    className="w-full bg-slate-800 border border-white/10 text-white text-sm rounded-xl pl-9 pr-3 py-2 placeholder:text-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors shrink-0"
                            >
                                Search
                            </button>
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => { setSearchInput(""); setSearch(""); setPage(1) }}
                                    className="p-2 text-gray-500 hover:text-white transition-colors"
                                    title="Clear search"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </form>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">
                            <strong>System Error:</strong> {error}
                        </div>
                    )}

                    <div className="glass-card overflow-hidden border border-white/5 bg-white/5 rounded-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-800/50 text-gray-400 text-[10px] uppercase font-black tracking-widest border-b border-white/10">
                                    <tr>
                                        <th className="px-6 py-4">User</th>
                                        <th className="px-6 py-4">Role</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Payout</th>
                                        <th className="px-6 py-4">Joined</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-white/80">
                                    {users.map((u) => {
                                        const isBanned = !!u.deletedAt
                                        const isLocked = !isBanned && !!u.lockoutUntil && new Date(u.lockoutUntil) > new Date()
                                        const isActive = !isBanned && !isLocked
                                        const isSelf = u.id === user?.id
                                        return (
                                            <tr key={u.id} className={`transition-colors ${isBanned ? 'bg-red-500/5' : ''} hover:bg-white/5`}>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ring-1 ring-white/10 ${isBanned ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                            {(u.firstName?.[0] || u.email[0]).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-white flex items-center gap-2">
                                                                {u.firstName} {u.lastName}
                                                                {u.role === 'ADMIN' && <ShieldAlert size={14} className="text-yellow-400" />}
                                                                {u.dealerProfile?.isVerified && <BadgeCheck size={14} className="text-blue-400" />}
                                                            </p>
                                                            <p className="text-xs text-gray-400">{u.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {updating === u.id ? (
                                                        <Loader2 size={16} className="animate-spin text-primary" />
                                                    ) : (
                                                        <select
                                                            className="bg-slate-800 border-white/10 text-xs px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                                                            value={u.role}
                                                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                                            disabled={isSelf}
                                                        >
                                                            <option value="BUYER">BUYER</option>
                                                            <option value="SELLER">SELLER</option>
                                                            <option value="DEALER">DEALER</option>
                                                            <option value="CONTRACTOR">CONTRACTOR</option>
                                                            <option value="FINANCE_PARTNER">FINANCE_PARTNER</option>
                                                            <option value="INSURANCE_PARTNER">INSURANCE_PARTNER</option>
                                                            <option value="ADMIN">ADMIN</option>
                                                        </select>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold ${
                                                        isBanned ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                        isLocked ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                                                        'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                    }`}>
                                                        {isBanned ? 'BANNED' : isLocked ? 'LOCKED' : 'ACTIVE'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {u.role === 'SELLER' ? (
                                                        u.stripeConnectOnboardingComplete ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                                <CreditCard size={10} /> Stripe
                                                            </span>
                                                        ) : u.bankAccountNumber ? (
                                                            <div className="space-y-1">
                                                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                                    <Landmark size={10} /> Bank Transfer
                                                                </span>
                                                                <div className="text-[10px] text-gray-400 font-mono">
                                                                    <div>{u.bankAccountName}</div>
                                                                    <div>Sort: {u.bankSortCode} · ****{u.bankAccountNumber.slice(-4)}</div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                                <AlertCircle size={10} /> Not set
                                                            </span>
                                                        )
                                                    ) : (
                                                        <span className="text-[10px] text-gray-600">—</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-xs text-gray-400">
                                                    {new Date(u.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {!isSelf && (
                                                        <div className="relative inline-block" ref={openMenu === u.id ? menuRef : undefined}>
                                                            <button
                                                                onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                                                                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                                                            >
                                                                {updating === u.id
                                                                    ? <Loader2 size={18} className="animate-spin" />
                                                                    : <MoreHorizontal size={18} />
                                                                }
                                                            </button>
                                                            {openMenu === u.id && (
                                                                <div className="absolute right-0 top-full mt-1 w-44 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                                                                    {isBanned ? (
                                                                        <button
                                                                            onClick={() => handleUserAction(u.id, 'unban')}
                                                                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                                                                        >
                                                                            <ShieldCheck size={14} /> Unban User
                                                                        </button>
                                                                    ) : (
                                                                        <>
                                                                            {isLocked ? (
                                                                                <button
                                                                                    onClick={() => handleUserAction(u.id, 'unlock')}
                                                                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-blue-400 hover:bg-blue-500/10 transition-colors"
                                                                                >
                                                                                    <LockKeyholeOpen size={14} /> Unlock Account
                                                                                </button>
                                                                            ) : (
                                                                                <button
                                                                                    onClick={() => handleUserAction(u.id, 'lock')}
                                                                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                                                                                >
                                                                                    <LockKeyhole size={14} /> Lock 24h
                                                                                </button>
                                                                            )}
                                                                            {u.role !== 'ADMIN' && (
                                                                                <button
                                                                                    onClick={() => {
                                                                                        if (window.confirm(`Ban ${u.firstName || u.email}? They will no longer be able to log in.`)) {
                                                                                            handleUserAction(u.id, 'ban')
                                                                                        } else {
                                                                                            setOpenMenu(null)
                                                                                        }
                                                                                    }}
                                                                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors border-t border-white/5"
                                                                                >
                                                                                    <Ban size={14} /> Ban User
                                                                                </button>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-white/10 bg-slate-800/30 flex items-center justify-between text-xs font-medium text-gray-400">
                            <span>
                                {total === 0 ? "No users found" : `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total.toLocaleString()}`}
                                {search && <span className="ml-2 text-blue-400">· filtered by "{search}"</span>}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded disabled:opacity-40 transition-colors"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >Prev</button>
                                <span className="text-gray-600">pg {page} / {Math.max(1, Math.ceil(total / limit))}</span>
                                <button
                                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded disabled:opacity-40 transition-colors"
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={page * limit >= total}
                                >Next</button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
