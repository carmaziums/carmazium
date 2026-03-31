"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Users, Loader2, ArrowLeft, MoreHorizontal, ShieldAlert, BadgeCheck } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getAdminUsers, updateUserRole } from "@/lib/adminApi"

export default function AdminUsersPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [users, setUsers] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [updating, setUpdating] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const [page, setPage] = React.useState(1)
    const [total, setTotal] = React.useState(0)
    const limit = 20

    React.useEffect(() => {
        // Enforce Admin Access
        if (!authLoading) {
            if (!user) {
                router.replace('/auth/login')
                return
            }
            if (profile?.role !== 'ADMIN') {
                router.replace('/dashboard')
                return
            }
        }
    }, [user, profile, authLoading, router])

    const fetchUsers = async () => {
        try {
            setLoading(true)
            setError(null)
            const result = await getAdminUsers(page, limit)
            setUsers(result.data || [])
            setTotal(result.meta?.total || 0)
        } catch (err: any) {
            console.error('Failed to fetch admin users:', err)
            setError(err.message || "Failed to load system users.")
        } finally {
            setLoading(false)
        }
    }

    React.useEffect(() => {
        if (profile?.role === 'ADMIN') {
            fetchUsers()
        }
    }, [profile, page])

    const handleRoleChange = async (userId: string, newRole: string) => {
        try {
            setUpdating(userId)
            await updateUserRole(userId, newRole)
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
        } catch (err: any) {
            alert(err.message || 'Failed to update user role')
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

    if (!user || profile?.role !== 'ADMIN') return null;

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
                        </div>
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
                                        <th className="px-6 py-4">Joined</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-white/80">
                                    {users.map((u) => (
                                        <tr key={u.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 font-bold text-xs ring-1 ring-white/10">
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
                                                    !u.deletedAt && !u.lockoutUntil ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                                                    'bg-red-500/10 text-red-400 border border-red-500/20'
                                                }`}>
                                                    {u.deletedAt ? 'BANNED' : u.lockoutUntil ? 'LOCKED' : 'ACTIVE'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-gray-400">
                                                {new Date(u.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
                                                    <MoreHorizontal size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination footer */}
                        <div className="p-4 border-t border-white/10 bg-slate-800/30 flex items-center justify-between text-xs font-medium text-gray-400">
                            <span>Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}</span>
                            <div className="flex items-center gap-2">
                                <button 
                                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded disabled:opacity-50"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >Prev</button>
                                <button 
                                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded disabled:opacity-50"
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
