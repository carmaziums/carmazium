"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import {
    Kanban, PlusCircle, User, MessageSquare,
    Loader2, ChevronRight, Phone, Mail, ArrowUpRight,
    TrendingUp, ShieldCheck, Activity, X, Search, CheckCircle,
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { DEALER_ROUTE_CONFIG } from "@/config/dealerRouteConfig"
import { createChatRoom } from "@/lib/chatApi"
import { useRouter } from "next/navigation"

const COLUMNS = [
    { key: "NEW", label: "New Leads", color: "border-blue-500/40", dotColor: "bg-blue-400", bg: "from-blue-500/5" },
    { key: "CONTACTED", label: "Discovery", color: "border-amber-500/40", dotColor: "bg-amber-400", bg: "from-amber-500/5" },
    { key: "QUALIFIED", label: "Qualified", color: "border-purple-500/40", dotColor: "bg-purple-400", bg: "from-purple-500/5" },
    { key: "NEGOTIATING", label: "Negotiating", color: "border-cyan-500/40", dotColor: "bg-cyan-400", bg: "from-cyan-500/5" },
    { key: "WON", label: "Closed Won", color: "border-emerald-500/40", dotColor: "bg-emerald-400", bg: "from-emerald-500/5" },
    { key: "LOST", label: "Lost", color: "border-red-500/40", dotColor: "bg-red-400", bg: "from-red-500/5" },
]

const SOURCES = ["direct", "chat", "walk-in", "referral", "online-ad", "phone"] as const

// ─── Add Lead Modal ────────────────────────────────────────────────────────────

function AddLeadModal({
    onClose,
    onCreated,
}: {
    onClose: () => void
    onCreated: (lead: any) => void
}) {
    const [form, setForm] = React.useState({
        buyerName: "",
        buyerEmail: "",
        buyerPhone: "",
        source: "direct",
        notes: "",
    })
    const [listings, setListings] = React.useState<any[]>([])
    const [listingSearch, setListingSearch] = React.useState("")
    const [selectedListing, setSelectedListing] = React.useState<any | null>(null)
    const [loadingListings, setLoadingListings] = React.useState(false)
    const [submitting, setSubmitting] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    // Load dealer's listings for linking
    React.useEffect(() => {
        setLoadingListings(true)
        apiClient<{ data: any[] }>('/listings/my?limit=50')
            .then(res => setListings(res?.data ?? []))
            .catch(() => setListings([]))
            .finally(() => setLoadingListings(false))
    }, [])

    const filteredListings = listings.filter(l =>
        l.title?.toLowerCase().includes(listingSearch.toLowerCase()) ||
        l.make?.toLowerCase().includes(listingSearch.toLowerCase())
    )

    const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.buyerName.trim()) { setError("Buyer name is required"); return }
        setSubmitting(true)
        setError(null)
        try {
            const res = await apiClient<{ data: any }>('/dealers/leads', {
                method: 'POST',
                body: JSON.stringify({
                    buyerName: form.buyerName.trim(),
                    buyerEmail: form.buyerEmail.trim() || undefined,
                    buyerPhone: form.buyerPhone.trim() || undefined,
                    source: form.source,
                    notes: form.notes.trim() || undefined,
                    listingId: selectedListing?.id || undefined,
                    status: 'NEW',
                }),
            })
            onCreated(res.data)
            onClose()
        } catch (err: any) {
            setError(err.message || "Failed to create lead")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-black text-white">Add Lead</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Buyer Name */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Buyer Name *</label>
                        <input
                            type="text"
                            value={form.buyerName}
                            onChange={e => set('buyerName', e.target.value)}
                            placeholder="e.g. James Wilson"
                            className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                        />
                    </div>

                    {/* Email + Phone */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Email</label>
                            <input
                                type="email"
                                value={form.buyerEmail}
                                onChange={e => set('buyerEmail', e.target.value)}
                                placeholder="buyer@email.com"
                                className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Phone</label>
                            <input
                                type="tel"
                                value={form.buyerPhone}
                                onChange={e => set('buyerPhone', e.target.value)}
                                placeholder="+44 7700 ..."
                                className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Source */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Lead Source</label>
                        <select
                            value={form.source}
                            onChange={e => set('source', e.target.value)}
                            className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-colors appearance-none cursor-pointer"
                        >
                            {SOURCES.map(s => (
                                <option key={s} value={s} className="bg-slate-900 capitalize">{s.replace('-', ' ')}</option>
                            ))}
                        </select>
                    </div>

                    {/* Linked Listing */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Link to Listing (optional)</label>
                        {selectedListing ? (
                            <div className="flex items-center justify-between bg-slate-800 border border-primary/30 rounded-xl px-4 py-2.5">
                                <span className="text-sm text-white font-medium truncate">{selectedListing.title}</span>
                                <button type="button" onClick={() => setSelectedListing(null)} className="text-gray-500 hover:text-white ml-2 shrink-0">
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    value={listingSearch}
                                    onChange={e => setListingSearch(e.target.value)}
                                    placeholder="Search your listings..."
                                    className="w-full bg-slate-800 border border-white/10 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                                />
                                {listingSearch && filteredListings.length > 0 && (
                                    <div className="absolute top-full mt-1 left-0 right-0 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-10 max-h-40 overflow-y-auto">
                                        {filteredListings.slice(0, 5).map(l => (
                                            <button
                                                key={l.id}
                                                type="button"
                                                className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2"
                                                onClick={() => { setSelectedListing(l); setListingSearch("") }}
                                            >
                                                <CheckCircle size={12} className="text-primary shrink-0" />
                                                {l.title}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {loadingListings && (
                                    <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 animate-spin" />
                                )}
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Notes</label>
                        <textarea
                            value={form.notes}
                            onChange={e => set('notes', e.target.value)}
                            rows={2}
                            placeholder="Any relevant notes about this lead..."
                            className="w-full bg-slate-800 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-colors resize-none"
                        />
                    </div>

                    {error && (
                        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                    )}

                    <div className="flex gap-3 pt-2">
                        <Button type="button" variant="outline" className="flex-1 border-white/10" onClick={onClose} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button type="submit" className="flex-1 shadow-neon" disabled={submitting}>
                            {submitting ? <Loader2 size={15} className="animate-spin mr-2" /> : <PlusCircle size={15} className="mr-2" />}
                            Add Lead
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DealerCRMPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [leads, setLeads] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [updatingLeadId, setUpdatingLeadId] = React.useState<string | null>(null)
    const [showAddModal, setShowAddModal] = React.useState(false)
    const [startingChat, setStartingChat] = React.useState<string | null>(null)
    const [toast, setToast] = React.useState<string | null>(null)
    const router = useRouter()

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
        // Optimistic update: Update the UI immediately
        const previousLeads = [...leads]
        setLeads(current => current.map(lead => 
            lead.id === leadId ? { ...lead, status } : lead
        ))
        
        setUpdatingLeadId(leadId)
        try {
            const res = await apiClient<{ data: any }>(`/dealers/leads/${leadId}`, {
                method: "PATCH",
                body: JSON.stringify({ status }),
            })
            // Sync with actual server data (in case there are other changes like updatedAt)
            const updatedLead = res?.data
            setLeads(prev => prev.map(lead => (lead.id === leadId ? { ...lead, ...updatedLead } : lead)))
        } catch (err) {
            console.error("Failed to update lead status:", err)
            // Rollback on error
            setLeads(previousLeads)
            showToast("Failed to update lead status")
        } finally {
            setUpdatingLeadId(null)
        }
    }

    async function handleMessageBuyer(lead: any) {
        if (!lead.buyerId) {
            showToast("This lead has no linked buyer account. Use email/phone to contact them.")
            return
        }
        setStartingChat(lead.id)
        try {
            const room = await createChatRoom(lead.buyerId, lead.listingId)
            router.push(`/dashboard/dealer/messages?room=${room.id}`)
        } catch (err: any) {
            showToast(err.message || "Failed to start chat")
        } finally {
            setStartingChat(null)
        }
    }

    function showToast(msg: string) {
        setToast(msg)
        setTimeout(() => setToast(null), 4000)
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split('@')[0] || "Dealer")

    const leadsByStatus = (status: string) => leads.filter(l => l.status === status)

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            {showAddModal && (
                <AddLeadModal
                    onClose={() => setShowAddModal(false)}
                    onCreated={(lead) => {
                        setLeads(prev => [lead, ...prev])
                        showToast("✓ Lead added successfully")
                    }}
                />
            )}

            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-800 border border-white/10 text-white px-5 py-3 rounded-xl shadow-2xl text-sm font-medium animate-in slide-in-from-bottom-4">
                    {toast}
                </div>
            )}

            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    <PageHeader
                        title={DEALER_ROUTE_CONFIG[2].title}
                        subHeader={DEALER_ROUTE_CONFIG[2].subHeader}
                    >
                        <Button
                            onClick={() => setShowAddModal(true)}
                            className="gap-2 h-11 px-6 rounded-xl shadow-[0_0_20px_rgba(237,28,36,0.3)] bg-gradient-to-r from-red-600 to-red-700 hover:scale-105 transition-all"
                            shape="default"
                        >
                            <PlusCircle size={18} /> Add Lead
                        </Button>
                    </PageHeader>

                    {/* Stats bar */}
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { label: "Total", count: leads.length, color: "text-white" },
                            { label: "Active", count: leads.filter(l => !['WON','LOST'].includes(l.status)).length, color: "text-amber-400" },
                            { label: "Won", count: leads.filter(l => l.status === 'WON').length, color: "text-emerald-400" },
                        ].map(s => (
                            <div key={s.label} className="glass-card p-4 text-center">
                                <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
                                <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">{s.label}</p>
                            </div>
                        ))}
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
                                            <span className="ml-auto bg-white/5 px-2.5 py-1 rounded-full text-xs font-black text-gray-400 border border-white/5">
                                                {leadsByStatus(col.key).length}
                                            </span>
                                        </div>
                                    </div>
                                    <div 
                                        className="bg-[#0A0A0C]/40 rounded-b-2xl min-h-[500px] p-3 space-y-3 border-x border-b border-white/5 relative transition-colors duration-200"
                                        onDragOver={(e) => {
                                            e.preventDefault()
                                            e.currentTarget.classList.add('bg-white/[0.05]')
                                        }}
                                        onDragLeave={(e) => {
                                            e.currentTarget.classList.remove('bg-white/[0.05]')
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault()
                                            e.currentTarget.classList.remove('bg-white/[0.05]')
                                            const leadId = e.dataTransfer.getData("leadId")
                                            if (leadId) updateLeadStatus(leadId, col.key)
                                        }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none rounded-b-2xl" />

                                        {leadsByStatus(col.key).length === 0 ? (
                                            <div className="text-center py-16 flex flex-col items-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center opacity-20">
                                                    <ShieldCheck size={20} className="text-gray-500" />
                                                </div>
                                                <p className="text-gray-600 text-xs font-black uppercase tracking-widest">Empty</p>
                                            </div>
                                        ) : (
                                            leadsByStatus(col.key).map((lead: any) => (
                                                <div 
                                                    key={lead.id} 
                                                    draggable
                                                    onDragStart={(e) => {
                                                        e.dataTransfer.setData("leadId", lead.id)
                                                        e.dataTransfer.effectAllowed = "move"
                                                        e.currentTarget.classList.add('opacity-50')
                                                    }}
                                                    onDragEnd={(e) => {
                                                        e.currentTarget.classList.remove('opacity-50')
                                                    }}
                                                    className="dealer-glass-card p-5 group hover:ring-1 hover:ring-primary/40 transition-all border-white/5 bg-slate-900/40 cursor-grab active:cursor-grabbing"
                                                >
                                                    {/* Header */}
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 bg-black/60 rounded-xl flex items-center justify-center border border-white/10 shadow-2xl group-hover:border-primary/30 transition-colors">
                                                                <User size={16} className="text-gray-400 group-hover:text-primary transition-colors" />
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-white text-sm tracking-tight">{lead.buyerName}</p>
                                                                <p className="text-xs font-bold text-primary uppercase tracking-widest">{lead.source || 'direct'}</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Linked listing */}
                                                    {lead.listing && (
                                                        <div className="mb-4 p-2.5 bg-black/40 rounded-xl border border-white/5 group-hover:bg-black/60 transition-colors">
                                                            <p className="text-xs text-gray-500 font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                                                                <TrendingUp size={10} /> Interested In
                                                            </p>
                                                            <p className="text-xs text-white font-bold truncate tracking-tight">{lead.listing.title}</p>
                                                        </div>
                                                    )}

                                                    {/* Contact actions */}
                                                    <div className="flex items-center gap-2 mb-4">
                                                        {lead.buyerEmail && (
                                                            <a
                                                                href={`mailto:${lead.buyerEmail}`}
                                                                title={lead.buyerEmail}
                                                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 rounded-lg border border-white/5 hover:bg-blue-500/10 hover:border-blue-500/20 hover:text-blue-400 transition-all text-gray-400 text-xs"
                                                            >
                                                                <Mail size={12} />
                                                                <span className="hidden group-hover:inline text-xs max-w-[80px] truncate">{lead.buyerEmail}</span>
                                                            </a>
                                                        )}
                                                        {lead.buyerPhone && (
                                                            <a
                                                                href={`tel:${lead.buyerPhone}`}
                                                                title={lead.buyerPhone}
                                                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 rounded-lg border border-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/20 hover:text-emerald-400 transition-all text-gray-400 text-xs"
                                                            >
                                                                <Phone size={12} />
                                                                <span className="text-xs">{lead.buyerPhone}</span>
                                                            </a>
                                                        )}
                                                        {lead.buyerId && (
                                                            <button
                                                                onClick={() => handleMessageBuyer(lead)}
                                                                disabled={startingChat === lead.id}
                                                                title="Message buyer"
                                                                className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 rounded-lg border border-white/5 hover:bg-primary/10 hover:border-primary/20 hover:text-primary transition-all text-gray-400 text-xs disabled:opacity-50"
                                                            >
                                                                {startingChat === lead.id
                                                                    ? <Loader2 size={12} className="animate-spin" />
                                                                    : <MessageSquare size={12} />
                                                                }
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Status selector */}
                                                    <div className="pt-4 border-t border-white/5">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <label className="text-[8px] text-gray-500 uppercase font-black tracking-widest">Phase Status</label>
                                                            {updatingLeadId === lead.id && <Loader2 size={10} className="animate-spin text-primary" />}
                                                        </div>
                                                        <select
                                                            value={lead.status}
                                                            disabled={updatingLeadId === lead.id}
                                                            onChange={e => updateLeadStatus(lead.id, e.target.value)}
                                                            className="w-full bg-black/40 border border-white/10 text-white rounded-xl px-3 py-2 text-xs font-bold tracking-widest uppercase focus:outline-none focus:ring-1 focus:ring-primary/40 appearance-none cursor-pointer hover:bg-black/60 transition-colors"
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
