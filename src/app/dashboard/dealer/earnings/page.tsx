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
    Download,
    Car,
    ChevronRight,
    Building2,
    Receipt,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { ReceiptsTab } from "@/components/dashboard/ReceiptsTab"
import { useAuth } from "@/context/AuthContext"
import { getEarnings, formatPrice, type SaleRecord, type EarningsResponse } from "@/lib/listingApi"

export default function DealerEarningsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [data, setData] = React.useState<EarningsResponse | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [searchTerm, setSearchTerm] = React.useState("")
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
                <DashboardSidebar role="dealer" userName={userName} userType="Dealership Account" />

                <main className="flex-1 space-y-8 min-w-0">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-neon-small shrink-0">
                                <DollarSign size={28} className="text-primary" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black font-heading text-white uppercase tracking-tight">Dealership Earnings</h1>
                                <p className="text-gray-400 mt-0.5 font-medium text-sm">Comprehensive revenue oversight for your dealership inventory.</p>
                            </div>
                        </div>
                        <Button className="flex items-center gap-2 shadow-neon h-12" variant="outline" size="sm">
                            <Download size={18} /> Financial Report
                        </Button>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <MetricCard 
                            label="Total Dealership Revenue" 
                            value={formatPrice(data?.totalRevenue || 0)} 
                            icon={Building2} 
                            color="text-emerald-400" 
                            bg="bg-emerald-500/10" 
                            border="border-emerald-500/20" 
                            loading={loading} 
                        />
                        <MetricCard 
                            label="Total Units Sold" 
                            value={data?.totalSales || 0} 
                            icon={TrendingUp} 
                            color="text-primary" 
                            bg="bg-primary/10" 
                            border="border-primary/20" 
                            loading={loading} 
                        />
                        <MetricCard 
                            label="Avg. Unit Margin" 
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
                                {tab === 'sales' ? 'Sales Registry' : 'Receipts'}
                            </button>
                        ))}
                    </div>

                    {/* Receipts tab */}
                    {activeTab === 'receipts' && (
                        <div className="glass-card overflow-hidden border border-white/5 bg-white/5 rounded-3xl shadow-2xl">
                            <div className="p-8 border-b border-white/10 bg-gradient-to-r from-white/[0.05] to-transparent">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-8 bg-primary rounded-full" />
                                    <h2 className="text-2xl font-black font-heading text-white uppercase tracking-tight">Payment Receipts</h2>
                                </div>
                                <p className="text-xs text-gray-400 mt-1 ml-5">All platform fees, listing charges, and KYC payments.</p>
                            </div>
                            <ReceiptsTab isDealer={true} />
                        </div>
                    )}

                    {/* Sales Table */}
                    {activeTab === 'sales' && <div className="glass-card overflow-hidden border border-white/5 bg-white/5 rounded-3xl shadow-2xl overflow-hidden">
                        <div className="p-8 border-b border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-r from-white/[0.05] to-transparent">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-8 bg-primary rounded-full" />
                                <h2 className="text-2xl font-black font-heading text-white uppercase tracking-tight">Sales Registry</h2>
                            </div>
                            <div className="relative w-full md:w-80 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={20} />
                                <input 
                                    type="text" 
                                    placeholder="Search by vehicle, VRM or buyer..." 
                                    className="w-full bg-slate-800/80 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-white placeholder:text-gray-500 shadow-inner"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* ── Mobile cards (< sm) ── */}
                        <div className="sm:hidden divide-y divide-white/5">
                            {filteredSales.map((sale) => (
                                <div key={sale.id} className="flex items-center gap-3 p-4">
                                    <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-slate-800">
                                        {sale.listing.images?.[0] ? (
                                            <Image src={sale.listing.images[0]} alt="" fill className="object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-600"><Car size={20} /></div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black text-white text-sm truncate uppercase tracking-tight">{sale.listing.title}</p>
                                        <p className="text-[10px] text-gray-500 font-bold">{sale.listing.vrm || 'PRIVATE'}</p>
                                        <div className="flex items-center justify-between mt-1.5 gap-2">
                                            <span className="text-xs text-gray-400 truncate">
                                                {sale.buyer ? `${sale.buyer.firstName} ${sale.buyer.lastName || ''}`.trim() : (sale as any).buyerName || 'Direct'}
                                            </span>
                                            <span className="text-[10px] text-gray-500 shrink-0">{new Date(sale.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-black text-white text-base leading-none">{formatPrice(sale.soldPrice)}</p>
                                        <div className="mt-1">
                                            {Number(sale.soldPrice) >= Number(sale.listedPrice) ? (
                                                <span className="text-[10px] text-emerald-400 font-black flex items-center gap-0.5 justify-end">
                                                    <ArrowUpRight size={9} /> +{formatPrice(Number(sale.soldPrice) - Number(sale.listedPrice))}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-red-400 font-black flex items-center gap-0.5 justify-end">
                                                    <ArrowDownRight size={9} /> -{formatPrice(Number(sale.listedPrice) - Number(sale.soldPrice))}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ── Desktop table (≥ sm) ── */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-800/50 text-gray-400 text-[11px] uppercase font-black tracking-[0.2em] border-b border-white/5">
                                    <tr>
                                        <th className="px-8 py-6">Asset Details</th>
                                        <th className="px-8 py-6">Buyer Identity</th>
                                        <th className="px-8 py-6 text-right">MSRP</th>
                                        <th className="px-8 py-6 text-right">Closing Price</th>
                                        <th className="px-8 py-6 text-right">Net Value</th>
                                        <th className="px-8 py-6 text-center">Transaction Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-white/80">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="px-8 py-20 text-center">
                                                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                                                <p className="mt-4 text-gray-500 font-bold uppercase tracking-widest text-xs">Loading sales data...</p>
                                            </td>
                                        </tr>
                                    ) : filteredSales.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-8 py-32 text-center">
                                                <div className="flex flex-col items-center gap-4 text-gray-500">
                                                    <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center mb-2 border border-white/5 shadow-inner">
                                                        <Car size={48} className="opacity-10" />
                                                    </div>
                                                    <p className="font-bold text-lg">No transaction records found.</p>
                                                    <p className="text-sm opacity-60 max-w-xs mx-auto italic">Records will appear here once vehicles are marked as 'Sold' in your inventory.</p>
                                                    {searchTerm && <Button variant="ghost" size="sm" onClick={() => setSearchTerm("")} className="mt-4">Reset search filters</Button>}
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredSales.map((sale) => (
                                            <tr key={sale.id} className="hover:bg-white/[0.04] transition-all group">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-5">
                                                        <div className="relative w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-white/10 group-hover:border-primary/50 transition-all duration-300 shadow-lg">
                                                            {sale.listing.images?.[0] ? (
                                                                <Image src={sale.listing.images[0]} alt="" fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                                                            ) : (
                                                                <div className="w-full h-full bg-slate-800 flex items-center justify-center text-gray-600"><Car size={24} /></div>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-black text-white group-hover:text-primary transition-colors truncate uppercase tracking-tight text-base leading-tight">{sale.listing.title}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="bg-slate-700 text-gray-300 text-[10px] font-black px-2 py-0.5 rounded tracking-widest uppercase border border-white/5">
                                                                    {sale.listing.vrm || "PRIVATE"}
                                                                </span>
                                                                <span className="w-1 h-1 bg-gray-600 rounded-full" />
                                                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">ID: {sale.listingId.split('-')[0]}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center border border-white/5 shrink-0 text-gray-400 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                                            <UserIcon size={18} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-black text-white truncate uppercase tracking-tight">
                                                                {sale.buyer
                                                                    ? `${sale.buyer.firstName} ${sale.buyer.lastName || ""}`.trim()
                                                                    : (sale as any).buyerName || "Direct Buyer"}
                                                            </p>
                                                            <p className="text-[11px] text-gray-500 font-medium truncate">
                                                                {sale.buyer?.email || (sale as any).buyerEmail || "No email recorded"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-right font-bold text-gray-400 text-sm">
                                                    {formatPrice((sale as any).listing?.price ?? sale.listedPrice ?? 0)}
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <p className="font-black text-white text-lg leading-none">{formatPrice(sale.soldPrice)}</p>
                                                    <div className="flex items-center justify-end gap-1 mt-1.5">
                                                        {Number(sale.soldPrice) >= Number(sale.listedPrice) ? (
                                                            <span className="text-[10px] text-emerald-400 font-black flex items-center gap-0.5 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                                                <ArrowUpRight size={10} /> +{formatPrice(Number(sale.soldPrice) - Number(sale.listedPrice))}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-red-400 font-black flex items-center gap-0.5 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                                                                <ArrowDownRight size={10} /> -{formatPrice(Number(sale.listedPrice) - Number(sale.soldPrice))}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="inline-flex flex-col items-end px-4 py-2 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                                                        <span className="text-emerald-400 font-black text-lg leading-none">{formatPrice(sale.soldPrice)}</span>
                                                        <span className="text-[9px] text-emerald-500/60 font-black uppercase tracking-widest mt-1">Net Realized</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-center">
                                                    <div className="inline-block px-3 py-1 bg-slate-800 rounded-lg border border-white/5">
                                                        <p className="text-sm font-black text-gray-200 tracking-tight">
                                                            {new Date(sale.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </p>
                                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">{new Date(sale.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>{/* end hidden sm:block */}
                    </div>}
                </main>
            </div>
        </div>
    )
}
