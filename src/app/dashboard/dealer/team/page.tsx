"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import {
    Users, PlusCircle, Loader2, Shield, Briefcase,
    DollarSign, Mail, MoreVertical, UserX
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"

const ROLE_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
    ADMIN: { label: "Admin", icon: Shield, color: "text-primary", bg: "bg-primary/10" },
    SALES_AGENT: { label: "Sales Agent", icon: Briefcase, color: "text-blue-400", bg: "bg-blue-500/10" },
    FINANCE_MANAGER: { label: "Finance Manager", icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10" },
}

export default function DealerTeamPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [staff, setStaff] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [showInvite, setShowInvite] = React.useState(false)
    const [inviteEmail, setInviteEmail] = React.useState("")
    const [inviteRole, setInviteRole] = React.useState("SALES_AGENT")

    React.useEffect(() => {
        if (!authLoading && user) {
            setStaff([])
            setLoading(false)
        }
    }, [user, authLoading])

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split('@')[0] || "Dealer")

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-black font-heading uppercase tracking-tight">Team Management</h1>
                            <p className="text-gray-400 text-sm">Manage your dealership staff and roles</p>
                        </div>
                        <Button onClick={() => setShowInvite(!showInvite)} className="gap-2 h-10 shadow-neon" shape="default">
                            <PlusCircle size={16} /> Invite Staff
                        </Button>
                    </div>

                    {/* Invite Form */}
                    {showInvite && (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-in fade-in slide-in-from-top-2 duration-200">
                            <h3 className="font-black uppercase tracking-tight mb-4">Invite New Member</h3>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Input
                                    placeholder="Enter staff email address"
                                    type="email"
                                    value={inviteEmail}
                                    onChange={e => setInviteEmail(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 flex-1"
                                />
                                <select
                                    value={inviteRole}
                                    onChange={e => setInviteRole(e.target.value)}
                                    className="bg-slate-800 border border-white/10 text-white rounded-xl px-4 py-2 text-sm"
                                >
                                    <option value="SALES_AGENT">Sales Agent</option>
                                    <option value="FINANCE_MANAGER">Finance Manager</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                                <Button className="h-10 px-6 whitespace-nowrap shadow-neon" shape="default">
                                    <Mail size={16} className="mr-2" /> Send Invite
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Role Summary */}
                    <div className="grid grid-cols-3 gap-4">
                        {Object.entries(ROLE_CONFIG).map(([key, config]) => {
                            const count = staff.filter(s => s.role === key).length
                            return (
                                <div key={key} className="bg-white/5 border border-white/5 rounded-2xl p-5 flex items-center gap-4">
                                    <div className={`p-2.5 ${config.bg} rounded-xl`}>
                                        <config.icon size={18} className={config.color} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">{config.label}s</p>
                                        <p className="text-xl font-black text-white">{count}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Staff Grid */}
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : !staff.length ? (
                        <div className="bg-white/5 border border-white/5 rounded-2xl p-16 text-center">
                            <Users className="h-14 w-14 text-gray-700 mx-auto mb-4" />
                            <p className="text-gray-500 font-bold text-lg">No team members yet</p>
                            <p className="text-gray-600 text-sm mt-1 max-w-sm mx-auto">
                                Invite sales agents and finance managers to help manage your dealership
                            </p>
                            <Button onClick={() => setShowInvite(true)} className="mt-5 gap-2" shape="default">
                                <PlusCircle size={16} /> Invite Your First Member
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {staff.map((member: any) => {
                                const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.SALES_AGENT
                                return (
                                    <div key={member.id} className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors group">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center">
                                                    <span className="text-lg font-bold text-gray-400">
                                                        {member.user?.firstName?.[0]}{member.user?.lastName?.[0]}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white">{member.user?.firstName} {member.user?.lastName}</p>
                                                    <p className="text-xs text-gray-500">{member.user?.email}</p>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm" className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                                                <UserX size={16} />
                                            </Button>
                                        </div>
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${roleConfig.bg} ${roleConfig.color}`}>
                                            <roleConfig.icon size={12} />
                                            {roleConfig.label}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
