"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import {
    Kanban, PlusCircle, User, MessageSquare,
    Loader2, ChevronRight, Phone, Mail, ArrowUpRight
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"

const COLUMNS = [
    { key: "NEW", label: "New", color: "border-blue-500/40", dotColor: "bg-blue-400" },
    { key: "CONTACTED", label: "Contacted", color: "border-amber-500/40", dotColor: "bg-amber-400" },
    { key: "QUALIFIED", label: "Qualified", color: "border-purple-500/40", dotColor: "bg-purple-400" },
    { key: "NEGOTIATING", label: "Negotiating", color: "border-cyan-500/40", dotColor: "bg-cyan-400" },
    { key: "WON", label: "Won", color: "border-emerald-500/40", dotColor: "bg-emerald-400" },
    { key: "LOST", label: "Lost", color: "border-red-500/40", dotColor: "bg-red-400" },
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
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-black font-heading uppercase tracking-tight">Leads Pipeline</h1>
                            <p className="text-gray-400 text-sm">Track and manage your sales pipeline</p>
                        </div>
                        <Button className="gap-2 h-10 shadow-neon" shape="default">
                            <PlusCircle size={16} /> Add Lead
                        </Button>
                    </div>

                    {/* Kanban Board */}
                    {loading ? (
                        <div className="flex items-center justify-center py-24">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
                            {COLUMNS.map(col => (
                                <div key={col.key} className="flex-shrink-0 w-72">
                                    <div className={`border-t-2 ${col.color} rounded-t-xl`}>
                                        <div className="flex items-center gap-2 px-4 py-3 bg-white/5 rounded-t-xl">
                                            <div className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                                            <span className="text-xs font-black uppercase tracking-widest text-white">{col.label}</span>
                                            <span className="ml-auto bg-white/10 px-2 py-0.5 rounded-full text-[10px] font-bold text-gray-400">
                                                {leadsByStatus(col.key).length}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="bg-white/[0.02] rounded-b-xl min-h-[300px] p-2 space-y-2 border border-white/5 border-t-0">
                                        {leadsByStatus(col.key).length === 0 ? (
                                            <div className="text-center py-8 text-gray-600 text-xs">
                                                No leads
                                            </div>
                                        ) : (
                                            leadsByStatus(col.key).map((lead: any) => (
                                                <div key={lead.id} className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-primary/30 transition-all cursor-pointer group">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 bg-slate-700 rounded-full flex items-center justify-center">
                                                                <User size={14} className="text-gray-400" />
                                                            </div>
                                                            <p className="font-bold text-white text-sm">{lead.buyerName}</p>
                                                        </div>
                                                        <ChevronRight size={14} className="text-gray-600 group-hover:text-primary transition-colors" />
                                                    </div>
                                                    {lead.listing && (
                                                        <p className="text-xs text-gray-400 mb-2 truncate">{lead.listing.title}</p>
                                                    )}
                                                    <div className="flex items-center gap-3 text-gray-500">
                                                        {lead.buyerEmail && <Mail size={12} />}
                                                        {lead.buyerPhone && <Phone size={12} />}
                                                        <span className="text-[10px] uppercase tracking-wider ml-auto">{lead.source || 'direct'}</span>
                                                    </div>
                                                    <div className="mt-3 pt-3 border-t border-white/10">
                                                        <label className="text-[10px] text-gray-500 uppercase tracking-wider">
                                                            Update status
                                                        </label>
                                                        <select
                                                            value={lead.status}
                                                            disabled={updatingLeadId === lead.id}
                                                            onChange={e => updateLeadStatus(lead.id, e.target.value)}
                                                            className="mt-1 w-full bg-slate-800 border border-white/10 text-white rounded-lg px-2 py-1.5 text-xs"
                                                        >
                                                            {COLUMNS.map(status => (
                                                                <option key={status.key} value={status.key}>
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
