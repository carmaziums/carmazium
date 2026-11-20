"use client"

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Car, PlusCircle, Search, Mail, Heart, Receipt, Settings, Users, Gavel, BarChart3, Wallet, Briefcase, ShieldCheck, Tag, Wrench, LayoutGrid, MessageSquare } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useDealerAccess } from '@/context/DealerAccessContext'
import type { DealerPermission } from '@/lib/dealerAccess'
import { Button } from '@/components/ui/Button'
import catalog from '@/data/dashboardCards.json'
import { defaultPreferences, parseDashboardPreferences, orderDashboardItems, moveDashboardItem, type DashboardPreferences } from '@/lib/dashboardPreferences'

const palette: Record<string, string> = { Sell: '#9d174d', Selling: '#9d174d', Buy: '#1e40af', Buying: '#1e40af', Business: '#6b21a8', Services: '#0f766e', Account: '#334155' }
const icons: Record<string, typeof Car> = { 'car-outline': Car, 'add-circle-outline': PlusCircle, 'search-outline': Search, 'mail-outline': Mail, 'heart-outline': Heart, 'receipt-outline': Receipt, 'bag-outline': Receipt, 'settings-outline': Settings, 'people-outline': Users, gavel: Gavel, 'hammer-outline': Gavel, 'bar-chart-outline': BarChart3, 'wallet-outline': Wallet, 'cash-outline': Wallet, 'briefcase-outline': Briefcase, 'shield-checkmark-outline': ShieldCheck, 'pricetag-outline': Tag, 'construct-outline': Wrench, 'grid-outline': LayoutGrid, 'chatbubbles-outline': MessageSquare, 'chatbubble-outline': MessageSquare }
type Card = { id: string; label: string; section: string; icon: string; href: string; requiredPermission?: string }

export function DashboardCards({ mode }: { mode: 'dealer' | 'personal' }) {
  const { user } = useAuth()
  return user ? <AccountCards key={`${user.id}:${mode}`} userId={user.id} mode={mode} /> : null
}

function AccountCards({ userId, mode }: { userId: string; mode: 'dealer' | 'personal' }) {
  const access = useDealerAccess()
  const storageKey = `carmazium:dashboard:v1:${userId}:${mode}`
  const [preferences, setPreferences] = useState<DashboardPreferences>(defaultPreferences)
  const current = useRef(preferences)
  const [ready, setReady] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    try { current.current = parseDashboardPreferences(localStorage.getItem(storageKey)); setPreferences(current.current) }
    catch { setError('Your saved layout could not be loaded. Changes will replace it.') }
    setReady(true)
  }, [storageKey])
  const save = (next: DashboardPreferences) => {
    current.current = next; setPreferences(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setError(null) }
    catch { setError('Layout has not been saved. Tap Retry to save your changes.') }
  }
  const permitted = (catalog[mode] as Card[]).filter(item => mode !== 'dealer' || (
    (item.id !== 'dealer-offers-only' || (!access.loading && !access.hasPermission('VIEW_TRADE')))
    && (!item.requiredPermission || (!access.loading && access.hasPermission(item.requiredPermission as DealerPermission)))
  ))
  const ordered = orderDashboardItems(permitted, preferences)
  const shown = editing ? ordered : ordered.filter(item => !preferences.hidden.includes(item.id))
  return <section aria-label="Your dashboard tools" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-bold">Your dashboard</h2><p className="text-sm text-[var(--text-secondary)]">Everything you need, in your order.</p></div>
      <Button variant="outline" disabled={!ready} onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Customise'}</Button>
    </div>
    {error && <div role="alert" className="space-y-2"><p>{error}</p><Button variant="outline" onClick={() => save(current.current)}>Retry save</Button></div>}
    {mode === 'dealer' && access.error && <div role="alert"><p>Some tools are hidden because permissions could not be loaded.</p><Button variant="outline" onClick={() => void access.refresh()}>Retry permissions</Button></div>}
    {!ready ? <p role="status">Loading dashboard layout…</p> : <>
      {editing && <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[var(--text-secondary)]">Show or hide cards, then use Earlier and Later to change their order. Your layout is saved in this browser.</p><Button variant="ghost" onClick={() => save(defaultPreferences())}>Reset layout</Button></div>}
      {!shown.length && <p>All cards are hidden. Choose Customise to show them again.</p>}
      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 xl:grid-cols-3 gap-4">{shown.map(item => {
        const Icon = icons[item.icon] || LayoutGrid
        const hidden = preferences.hidden.includes(item.id), index = ordered.findIndex(entry => entry.id === item.id)
        return <article key={item.id} data-card-id={item.id} className={`min-w-0 overflow-hidden rounded-[20px] border-b-4 border-black/20 text-white ${hidden ? 'opacity-55' : ''}`} style={{ backgroundColor: palette[item.section] || '#334155' }}>
          <Link href={item.href} aria-label={item.label} className="flex min-h-[166px] flex-col items-start gap-2 p-[18px] transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-[-4px] focus-visible:outline-white">
            <span className="mb-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-white/15"><Icon size={27} aria-hidden="true" /></span>
            <span className="text-xs">{item.section}</span><span className="text-[17px] font-bold leading-6 break-words">{item.label}</span>
          </Link>
          {editing && <div className="flex flex-col gap-1.5 border-t border-white/25 p-2">
            <button type="button" role="switch" aria-label={`Show ${item.label}`} aria-checked={!hidden} className="min-h-12 rounded-lg bg-white/15 px-2 py-3 text-sm font-bold hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white" onClick={() => save({ ...current.current, hidden: hidden ? current.current.hidden.filter(id => id !== item.id) : [...current.current.hidden, item.id] })}>{hidden ? 'Show card' : 'Hide card'}</button>
            {([-1, 1] as const).map(direction => <button key={direction} type="button" aria-label={`Move ${item.label} ${direction === -1 ? 'earlier' : 'later'}`} disabled={direction === -1 ? index === 0 : index === ordered.length - 1} className="min-h-12 rounded-lg bg-white/15 px-2 py-3 text-sm font-bold hover:bg-white/25 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-white" onClick={() => save(moveDashboardItem(current.current, ordered.map(entry => entry.id), item.id, direction))}>{direction === -1 ? 'Earlier' : 'Later'}</button>)}
          </div>}
        </article>
      })}</div>
    </>}
  </section>
}
