"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import {
    Users, PlusCircle, Loader2, Shield, Briefcase,
    DollarSign, Mail, MoreVertical, UserX, ShieldCheck, Activity, Star
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { DEALER_ROUTE_CONFIG } from "@/config/dealerRouteConfig"
import { MetricCard } from "@/components/dashboard/MetricCard"

const ROLE_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
    ADMIN: { label: "Executive Admin", icon: Shield, color: "text-primary", bg: "bg-primary/10" },
    SALES_AGENT: { label: "Sales Consultant", icon: Briefcase, color: "text-blue-400", bg: "bg-blue-500/10" },
    FINANCE_MANAGER: { label: "Capital Director", icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10" },
}

export default function DealerTeamPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [staff, setStaff] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [showInvite, setShowInvite] = React.useState(false)
    const [inviteEmail, setInviteEmail] = React.useState("")
    const [inviteRole, setInviteRole] = React.useState("SALES_AGENT")
    const [inviting, setInviting] = React.useState(false)

    React.useEffect(() => {
        if (!authLoading && user) {
            fetchStaff()
        }
    }, [user, authLoading])

    async function fetchStaff() {
        setLoading(true)
        try {
            const res = await apiClient<{ data: any[] }>('/dealers/staff')
            setStaff(res?.data ?? [])
        } catch (err) {
            console.error('Failed to load staff:', err)
            setStaff([])
        } finally {
            setLoading(false)
        }
    }

    async function handleInvite() {
        if (!inviteEmail) return
        setInviting(true)
        try {
            await apiClient('/dealers/staff', {
                method: 'POST',
                body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
            })
            setInviteEmail("")
            setShowInvite(false)
            fetchStaff()
        } catch (err) {
            console.error('Failed to invite staff:', err)
        } finally {
            setInviting(false)
        }
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split('@')[0] || "Dealer")

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    <PageHeader 
                        title={DEALER_ROUTE_CONFIG[7].title} 
                        subHeader={DEALER_ROUTE_CONFIG[7].subHeader}
                    >
                        <Button onClick={() => setShowInvite(!showInvite)} className="gap-2 h-11 px-6 rounded-xl shadow-[0_0_20px_rgba(237,28,36,0.3)] bg-gradient-to-r from-red-600 to-red-700 hover:scale-105 transition-all">
                            <PlusCircle size={18} /> Add Personnel
                        </Button>
                    </PageHeader>

                    {/* Invite Form */}
                    {showInvite && (
                        <div className="dealer-glass-card p-8 animate-in fade-in slide-in-from-top-2 duration-300 bg-slate-900/40 border-primary/20 ring-1 ring-primary/10">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
                                    <PlusCircle size={18} className="text-primary" />
                                </div>
                                <h3 className="font-black text-white uppercase tracking-widest text-sm">Authorize New Personnel</h3>
                            </div>
                            <div className="flex flex-col lg:flex-row gap-4">
                                <Input
                                    placeholder="Direct corporate email address"
                                    type="email"
                                    value={inviteEmail}
                                    onChange={e => setInviteEmail(e.target.value)}
                                    className="bg-black/60 border-white/5 text-white placeholder:text-gray-600 flex-1 h-12 rounded-xl focus:ring-1 focus:ring-primary/40"
                                />
                                <div className="relative group">
                                    <select
                                        value={inviteRole}
                                        onChange={e => setInviteRole(e.target.value)}
                                        className="bg-black/60 border border-white/5 text-white rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest h-12 min-w-[200px] appearance-none cursor-pointer focus:ring-1 focus:ring-primary/40"
                                    >
                                        <option value="SALES_AGENT">Sales Consultant</option>
                                        <option value="FINANCE_MANAGER">Capital Director</option>
                                        <option value="ADMIN">Executive Admin</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                                        <Activity size={12} />
                                    </div>
                                </div>
                                <Button onClick={handleInvite} disabled={inviting} className="h-12 px-8 whitespace-nowrap bg-white text-black font-black uppercase tracking-widest text-[10px] hover:bg-gray-200 rounded-xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                                    {inviting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Mail size={16} className="mr-2" />} {inviting ? 'AUTHORIZING…' : 'DISPATCH INVITE'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Role Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.entries(ROLE_CONFIG).map(([key, config]) => {
                            const count = staff.filter(s => s.role === key).length
                            return (
                                <MetricCard 
                                    key={key}
                                    label={`${config.label}s`}
                                    value={count}
                                    icon={config.icon}
                                    color={config.color}
                                    bg={config.bg}
                                    border="border-white/5"
                                    statusLabel="Active"
                                    foilValue={true}
                                />
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
                                    <div key={member.id} className="dealer-glass-card p-6 group relative overflow-hidden bg-slate-900/40 border-white/5 hover:translate-y-[-4px] transition-all">
                                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg">
                                                <UserX size={14} />
                                            </Button>
                                        </div>
                                        
                                        <div className="flex flex-col items-center text-center mb-6">
                                            <div className="relative mb-4">
                                                <div className="w-20 h-20 bg-black/60 rounded-3xl flex items-center justify-center border border-white/10 group-hover:border-primary/40 transition-colors shadow-2xl relative z-10 overflow-hidden">
                                                    <span className="text-2xl font-black text-white opacity-40">
                                                        {member.user?.firstName?.[0]}{member.user?.lastName?.[0]}
                                                    </span>
                                                    <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent" />
                                                </div>
                                                <div className="absolute -bottom-2 -right-2 p-1.5 bg-[#0A0A0C] border border-white/10 rounded-xl shadow-2xl z-20">
                                                    <ShieldCheck size={14} className="text-emerald-400" />
                                                </div>
                                            </div>
                                            
                                            <p className="font-black text-white text-lg tracking-tighter group-hover:text-primary transition-colors">{member.user?.firstName} {member.user?.lastName}</p>
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">{member.user?.email}</p>
                                        </div>

                                        <div className="space-y-3 pt-4 border-t border-white/5">
                                            <div className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 ${roleConfig.bg} ${roleConfig.color}`}>
                                                <roleConfig.icon size={14} />
                                                {roleConfig.label}
                                            </div>
                                            <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-gray-600 px-1">
                                                <span>Performance Index</span>
                                                <div className="flex gap-0.5">
                                                    {[1,2,3,4,5].map(i => <Star key={i} size={8} className={i <= 4 ? "text-amber-500/40" : "text-gray-800"} fill="currentColor" />)}
                                                </div>
                                            </div>
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
