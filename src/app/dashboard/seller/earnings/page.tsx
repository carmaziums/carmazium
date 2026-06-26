"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { 
    DollarSign, 
    TrendingUp, 
    Calendar, 
    User as UserIcon, 
    ArrowUpRight, 
    ArrowDownRight,
    Loader2,
    Search,
    Filter,
    Download,
    ChevronRight,
    Car
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { ReceiptsTab } from "@/components/dashboard/ReceiptsTab"
import { useAuth } from "@/context/AuthContext"
import { getEarnings, exportEarningsCsv, formatPrice, type SaleRecord, type EarningsResponse } from "@/lib/listingApi"

export default function EarningsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [data, setData] = React.useState<EarningsResponse | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [searchTerm, setSearchTerm] = React.useState("")
    const [exporting, setExporting] = React.useState(false)
    const [activeTab, setActiveTab] = React.useState<'sales' | 'receipts'>('sales')

    React.useEffect(() => {
        async function fetchData() {
            if (!user) return
            try {
                setLoading(true)
                const res = await getEarnings()
                setData(res)
            } catch (err) {
                console.error('Failed to fetch earnings:', err)
            } finally {
                setLoading(false)
            }
        }

        if (!authLoading && user) {
            fetchData()
        }
    }, [user, authLoading])

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    const filteredSales = data?.sales.filter(sale => 
        sale.listing.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.buyer?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.buyer?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.listing.vrm?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || []

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "User")

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="seller" userName={userName} userType={profile?.role ? `${profile.role} Account` : "Seller Account"} />

                <main className="flex-1 space-y-8 min-w-0">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-black font-heading text-white uppercase tracking-tight">Revenue & Earnings</h1>
                            <p className="text-gray-400 mt-1 font-medium text-sm">Track your sales performance and platform revenue.</p>
                        </div>
                        <Button
                            className="flex items-center gap-2 shadow-neon h-12"
                            variant="outline"
                            size="sm"
                            disabled={exporting}
                            onClick={async () => {
                                setExporting(true)
                                try { await exportEarningsCsv() } catch { alert('Export failed') } finally { setExporting(false) }
                            }}
                        >
                            {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} Export CSV
                        </Button>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <MetricCard 
                            label="Total Revenue" 
                            value={formatPrice(data?.totalRevenue || 0)} 
                            icon={DollarSign} 
                            color="text-emerald-400" 
                            bg="bg-emerald-500/10" 
                            border="border-emerald-500/20" 
                            loading={loading} 
                        />
                        <MetricCard 
                            label="Vehicles Sold" 
                            value={data?.totalSales || 0} 
                            icon={TrendingUp} 
                            color="text-primary" 
                            bg="bg-primary/10" 
                            border="border-primary/20" 
                            loading={loading} 
                        />
                        <MetricCard 
                            label="Avg. Sale Price" 
                            value={formatPrice(data?.totalSales ? (data.totalRevenue / data.totalSales) : 0)} 
                            icon={ArrowUpRight} 
                            color="text-blue-400" 
                            bg="bg-blue-500/10" 
                            border="border-blue-500/20" 
                            loading={loading} 
                        />
                    </div>

                    {/* Tab switcher */}
                    <div className="flex gap-1 bg-slate-800/50 p-1 rounded-xl border border-white/5 w-fit">
                        {(['sales', 'receipts'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-primary text-white shadow-neon-small' : 'text-gray-400 hover:text-white'}`}
                            >
                                {tab === 'sales' ? 'Sales History' : 'Receipts'}
                            </button>
                        ))}
                    </div>

                    {/* Receipts tab */}
                    {activeTab === 'receipts' && (
                        <div className="glass-card overflow-hidden border border-white/5 bg-white/5 rounded-2xl shadow-2xl">
                            <div className="p-6 border-b border-white/10 bg-white/2">
                                <h2 className="text-xl font-black font-heading text-white uppercase tracking-tight flex items-center gap-2">
                                    Payment Receipts
                                </h2>
                                <p className="text-xs text-gray-400 mt-1">All payments made or received through CarMazium.</p>
                            </div>
                            <ReceiptsTab isDealer={false} />
                        </div>
                    )}

                    {/* Sales Table */}
                    {activeTab === 'sales' && <div className="glass-card overflow-hidden border border-white/5 bg-white/5 rounded-2xl shadow-2xl">
                        <div className="p-6 border-b border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/2">
                            <h2 className="text-xl font-black font-heading text-white uppercase tracking-tight flex items-center gap-2">
                                <Calendar className="text-primary" size={20} /> Sales History
                            </h2>
                            <div className="relative w-full md:w-64 group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Search listings or buyers..." 
                                    className="w-full bg-slate-800/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-white placeholder:text-gray-500"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-800/80 text-gray-400 text-xs uppercase font-black tracking-widest border-b border-white/5">
                                    <tr>
                                        <th className="px-6 py-5">Vehicle Details</th>
                                        <th className="px-6 py-5">Buyer</th>
                                        <th className="px-6 py-5 text-right">Listed Price</th>
                                        <th className="px-6 py-5 text-right">Sold Price</th>
                                        <th className="px-6 py-5 text-right">Net Earned</th>
                                        <th className="px-6 py-5 text-center">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-white/80">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                                            </td>
                                        </tr>
                                    ) : filteredSales.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-3 text-gray-500 italic">
                                                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-2">
                                                        <Car size={32} className="opacity-20" />
                                                    </div>
                                                    <p>No sales records found.</p>
                                                    {searchTerm && <Button variant="ghost" size="sm" onClick={() => setSearchTerm("")}>Clear search</Button>}
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredSales.map((sale) => (
                                            <tr key={sale.id} className="hover:bg-white/[0.03] transition-all group">
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-white/10 group-hover:border-primary/30 transition-colors">
                                                            {sale.listing.images?.[0] ? (
                                                                <Image src={sale.listing.images[0]} alt="" fill className="object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full bg-slate-800 flex items-center justify-center text-gray-600"><Car size={20} /></div>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-black text-white group-hover:text-primary transition-colors truncate uppercase tracking-tight">{sale.listing.title}</p>
                                                            <p className="text-xs text-gray-500 font-bold tracking-widest uppercase mt-0.5">{sale.listing.vrm || "Private Plate"}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center border border-white/10 shrink-0 text-gray-400">
                                                            <UserIcon size={14} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold text-gray-200 truncate">
                                                                {sale.buyer
                                                                    ? `${sale.buyer.firstName} ${sale.buyer.lastName || ""}`.trim()
                                                                    : (sale as any).buyerName || "Private Buyer"}
                                                            </p>
                                                            <p className="text-xs text-gray-500 truncate">
                                                                {sale.buyer?.email || (sale as any).buyerEmail || "No email recorded"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-right font-medium text-gray-400 text-sm">
                                                    {formatPrice((sale as any).listing?.price ?? sale.listedPrice ?? 0)}
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <p className="font-black text-white text-base">{formatPrice(sale.soldPrice)}</p>
                                                    {(() => {
                                                        const listed = Number((sale as any).listing?.price ?? sale.listedPrice ?? 0)
                                                        const sold = Number(sale.soldPrice)
                                                        if (sold > listed && listed > 0) return (
                                                            <span className="text-xs text-emerald-400 font-bold flex items-center justify-end gap-1">
                                                                <ArrowUpRight size={10} /> +{formatPrice(sold - listed)}
                                                            </span>
                                                        )
                                                        if (sold < listed && listed > 0) return (
                                                            <span className="text-xs text-red-400 font-bold flex items-center justify-end gap-1">
                                                                <ArrowDownRight size={10} /> -{formatPrice(listed - sold)}
                                                            </span>
                                                        )
                                                        return <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Asking Price</span>
                                                    })()}
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <div className="inline-flex flex-col items-end">
                                                        <span className="text-emerald-400 font-black text-base">{formatPrice(sale.soldPrice)}</span>
                                                        <span className="text-xs text-gray-500 font-bold uppercase tracking-tighter">After 0% Fee</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <p className="text-sm font-bold text-gray-300">
                                                        {new Date(sale.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </p>
                                                    <p className="text-xs text-gray-500">{new Date(sale.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        
                        <div className="p-6 bg-white/[0.02] border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-400">
                            <p className="font-medium">Showing {filteredSales.length} of {data?.totalSales || 0} sales records</p>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" disabled className="h-9 opacity-50">Previous</Button>
                                <Button variant="outline" size="sm" disabled className="h-9 opacity-50">Next</Button>
                            </div>
                        </div>
                    </div>}
                </main>
            </div>
        </div>
    )
}
