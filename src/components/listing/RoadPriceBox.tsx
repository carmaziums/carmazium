"use client"

import * as React from "react"
import { TrendingUp, Loader2, X, ExternalLink, BarChart3, AlertCircle } from "lucide-react"

interface RoadPriceBoxProps {
  make: string
  model: string
  year: string
  mileage: string
}

interface MarketListing {
  source: string
  price: number
  mileage?: number
  url?: string
}

interface RoadPriceData {
  make: string
  model: string
  year: number
  averagePrice: number
  minPrice: number
  maxPrice: number
  sampleSize: number
  listings: MarketListing[]
}

export function RoadPriceBox({ make, model, year, mileage }: RoadPriceBoxProps) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [data, setData] = React.useState<RoadPriceData | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const canSearch = !!(make && model && year)

  async function fetchRoadPrice() {
    if (!canSearch) return
    setLoading(true)
    setError(null)
    setData(null)
    setOpen(true)
    try {
      const params = new URLSearchParams({ make, model, year })
      if (mileage) params.set("mileage", mileage)
      const res = await fetch(`/api/road-price?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to fetch market data")
      const json = await res.json()
      setData(json)
    } catch (err: any) {
      setError(err.message || "Could not fetch market pricing data")
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (p: number) =>
    p > 0 ? `£${p.toLocaleString("en-GB")}` : "N/A"

  return (
    <div className="relative">
      {/* Trigger button — shown as a floating badge */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
            <TrendingUp size={16} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Road Price</p>
            <p className="text-[11px] text-gray-500">
              {canSearch
                ? `Get UK market rate for ${year} ${make} ${model}`
                : "Fill in make, model & year to check"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchRoadPrice}
          disabled={!canSearch || loading}
          className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <BarChart3 size={12} />}
          Road Price
        </button>
      </div>

      {/* Result panel */}
      {open && (
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-900/80 p-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-emerald-400" />
              <p className="text-sm font-bold text-white">
                UK Market Prices — {year} {make} {model}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {loading && (
            <div className="flex items-center gap-3 py-6 justify-center text-gray-400">
              <Loader2 size={18} className="animate-spin text-emerald-400" />
              <span className="text-sm">Checking UK market prices…</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {data && !loading && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-white/5 border border-white/5 p-3 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Average</p>
                  <p className="text-lg font-black text-emerald-400">{formatPrice(data.averagePrice)}</p>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/5 p-3 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Lowest</p>
                  <p className="text-lg font-black text-white">{formatPrice(data.minPrice)}</p>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/5 p-3 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Highest</p>
                  <p className="text-lg font-black text-white">{formatPrice(data.maxPrice)}</p>
                </div>
              </div>

              <p className="text-[11px] text-gray-500 text-center">
                Based on {data.sampleSize} similar listings across UK marketplaces
              </p>

              {/* Individual listings */}
              {data.listings.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Similar Listings Found</p>
                  {data.listings.slice(0, 5).map((l, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{l.source}</span>
                        {l.mileage && <span className="text-gray-600">{l.mileage.toLocaleString()} mi</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{formatPrice(l.price)}</span>
                        {l.url && (
                          <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-blue-400 transition-colors">
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[10px] text-gray-600 italic text-center">
                Prices sourced from AutoTrader, Motors.co.uk and Gumtree. Data is indicative only.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
