"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import {
    Kanban, PlusCircle, User, MessageSquare,
    Loader2, ChevronRight, Phone, Mail, ArrowUpRight,
    TrendingUp, ShieldCheck, Activity
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"

const COLUMNS = [
    { key: "NEW", label: "New Leads", color: "border-blue-500/40", dotColor: "bg-blue-400", bg: "from-blue-500/5" },
    { key: "CONTACTED", label: "Discovery", color: "border-amber-500/40", dotColor: "bg-amber-400", bg: "from-amber-500/5" },
    { key: "QUALIFIED", label: "Qualified", color: "border-purple-500/40", dotColor: "bg-purple-400", bg: "from-purple-500/5" },
    { key: "NEGOTIATING", label: "Negotiating", color: "border-cyan-500/40", dotColor: "bg-cyan-400", bg: "from-cyan-500/5" },
    { key: "WON", label: "Closed Won", color: "border-emerald-500/40", dotColor: "bg-emerald-400", bg: "from-emerald-500/5" },
    { key: "LOST", label: "Lost", color: "border-red-500/40", dotColor: "bg-red-400", bg: "from-red-500/5" },
]

export default function DealerCRMPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [leads, setLeads] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [updatingLeadId, setUpdatingLeadId] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (!authLoading && user) {
            fetchLeads()
        }
    }, [user, authLoading])

    async function fetchLeads() {
        setLoading(true)
        try {
            const res = await apiClient<{ data: any[] }>('/dealers/leads')
            setLeads(res?.data ?? [])
        } catch (err) {
            console.error('Failed to load leads:', err)
            setLeads([])
        } finally {
            setLoading(false)
        }
    }

    async function updateLeadStatus(leadId: string, status: string) {
        setUpdatingLeadId(leadId)
        try {
            const res = await apiClient<{ data: any }>(`/dealers/leads/${leadId}`, {
                method: "PATCH",
                body: JSON.stringify({ status }),
            })
            const updatedLead = res?.data
            setLeads(prev => prev.map(lead => (lead.id === leadId ? { ...lead, ...updatedLead } : lead)))
        } catch (err) {
            console.error("Failed to update lead status:", err)
        } finally {
            setUpdatingLeadId(null)
        }
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split('@')[0] || "Dealer")

    const leadsByStatus = (status: string) => leads.filter(l => l.status === status)

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-3xl font-black font-heading uppercase tracking-tighter metallic-foil">Leads</h1>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1 opacity-70">Strategic lead management & conversion tracking</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="hidden lg:flex items-center gap-2 bg-[#0A0A0C] px-4 py-2 rounded-full border border-white/5">
                                <Activity size={14} className="text-emerald-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pipeline Alpha: <span className="text-emerald-400">High Velocity</span></span>
                            </div>
                            <Button className="gap-2 h-11 px-6 rounded-xl shadow-[0_0_20px_rgba(237,28,36,0.3)] bg-gradient-to-r from-red-600 to-red-700 hover:scale-105 transition-all" shape="default">
                                <PlusCircle size={18} /> Add Lead
                            </Button>
                        </div>
                    </div>

                    {/* Kanban Board */}
                    {loading ? (
                        <div className="flex items-center justify-center py-24">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="flex gap-4 overflow-x-auto pb-6 -mx-2 px-2 custom-scrollbar">
                            {COLUMNS.map(col => (
                                <div key={col.key} className="flex-shrink-0 w-80">
                                    <div className={`border-t-4 ${col.color} rounded-t-2xl shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.5)]`}>
                                        <div className={`flex items-center gap-2 px-5 py-4 bg-gradient-to-b ${col.bg} to-transparent rounded-t-2xl border-x border-white/5`}>
                                            <div className={`w-2.5 h-2.5 rounded-full ${col.dotColor} animate-pulse shadow-[0_0_8px_currentColor]`} />
                                            <span className="text-xs font-black uppercase tracking-widest text-white">{col.label}</span>
                                            <span className="ml-auto bg-white/5 px-2.5 py-1 rounded-full text-[10px] font-black text-gray-400 border border-white/5">
                                                {leadsByStatus(col.key).length}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="bg-[#0A0A0C]/40 rounded-b-2xl min-h-[500px] p-3 space-y-3 border-x border-b border-white/5 relative">
                                        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none rounded-b-2xl" />
                                        
                                        {leadsByStatus(col.key).length === 0 ? (
                                            <div className="text-center py-16 flex flex-col items-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center opacity-20">
                                                    <ShieldCheck size={20} className="text-gray-500" />
                                                </div>
                                                <p className="text-gray-600 text-[10px] font-black uppercase tracking-widest">Clearing Queue</p>
                                            </div>
                                        ) : (
                                            leadsByStatus(col.key).map((lead: any) => (
                                                <div key={lead.id} className="dealer-glass-card p-5 group cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-primary/40 transition-all border-white/5 bg-slate-900/40">
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 bg-black/60 rounded-xl flex items-center justify-center border border-white/10 shadow-2xl group-hover:border-primary/30 transition-colors">
                                                                <User size={16} className="text-gray-400 group-hover:text-primary transition-colors" />
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-white text-sm tracking-tight">{lead.buyerName}</p>
                                                                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{lead.source || 'direct'}</p>
                                                            </div>
                                                        </div>
                                                        <div className="p-1.5 bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <ArrowUpRight size={14} className="text-gray-500" />
                                                        </div>
                                                    </div>

                                                    {lead.listing && (
                                                        <div className="mb-4 p-2.5 bg-black/40 rounded-xl border border-white/5 group-hover:bg-black/60 transition-colors">
                                                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                                                                <TrendingUp size={10} /> Interested In
                                                            </p>
                                                            <p className="text-xs text-white font-bold truncate tracking-tight">{lead.listing.title}</p>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center gap-3 text-gray-500">
                                                        <div className="flex items-center gap-1.5 p-1.5 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-all">
                                                            {lead.buyerEmail && <Mail size={12} />}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 p-1.5 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-all">
                                                            {lead.buyerPhone && <Phone size={12} />}
                                                        </div>
                                                        <div className="ml-auto flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded text-[8px] font-black text-emerald-400 border border-emerald-500/20">
                                                            <Activity size={8} /> LIVE
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 pt-4 border-t border-white/5">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <label className="text-[8px] text-gray-500 uppercase font-black tracking-widest">
                                                                Phase Status
                                                            </label>
                                                            {updatingLeadId === lead.id && <Loader2 size={10} className="animate-spin text-primary" />}
                                                        </div>
                                                        <select
                                                            value={lead.status}
                                                            disabled={updatingLeadId === lead.id}
                                                            onChange={e => updateLeadStatus(lead.id, e.target.value)}
                                                            className="w-full bg-black/40 border border-white/10 text-white rounded-xl px-3 py-2 text-[10px] font-bold tracking-widest uppercase focus:outline-none focus:ring-1 focus:ring-primary/40 appearance-none cursor-pointer hover:bg-black/60 transition-colors"
                                                        >
                                                            {COLUMNS.map(status => (
                                                                <option key={status.key} value={status.key} className="bg-slate-900">
                                                                    {status.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
