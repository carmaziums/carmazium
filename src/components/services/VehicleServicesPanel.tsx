"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldCheck, Truck, SearchCheck, Calculator } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { deliveryServiceEnabled, inspectionServiceEnabled, financeServiceEnabled, warrantyServiceEnabled } from '@/lib/featureFlags'
import { vehicleServicePath, type ServiceVehicle } from '@/lib/vehicleServiceContext'

export function VehicleServicesPanel({ listing }: { listing: ServiceVehicle }) {
    const [finance, setFinance] = useState<{ id: string; enabled: boolean } | null>(null)
    const available = listing.status === 'ACTIVE' && listing.type === 'CLASSIFIED'
    useEffect(() => {
        if (!available || !financeServiceEnabled) return
        let active = true
        apiClient<{ data: { enabled: boolean } }>(`/finance/referrals/listing/${encodeURIComponent(listing.id)}`)
            .then(({ data }) => { if (active) setFinance({ id: listing.id, enabled: data.enabled === true }) })
            .catch(() => { if (active) setFinance({ id: listing.id, enabled: false }) })
        return () => { active = false }
    }, [available, listing.id])
    if (!available || ![warrantyServiceEnabled, deliveryServiceEnabled, inspectionServiceEnabled, financeServiceEnabled].some(Boolean)) return null
    const items = [
        ...(warrantyServiceEnabled ? [{ title: 'Warranty', description: 'See prices and cover options for this vehicle.', href: `/services/warranty?listingId=${encodeURIComponent(listing.id)}`, icon: ShieldCheck }] : []),
        ...(financeServiceEnabled && finance?.id === listing.id && finance.enabled ? [{ title: 'Finance', description: 'Continue with the selected finance provider. Subject to status.', href: `/services/finance?listingId=${encodeURIComponent(listing.id)}`, icon: Calculator }] : []),
        ...(deliveryServiceEnabled ? [{ title: 'Delivery', description: 'Request quotes to collect and deliver this vehicle.', href: vehicleServicePath('delivery', listing), icon: Truck }] : []),
        ...(inspectionServiceEnabled ? [{ title: 'Request an inspection', description: 'Choose vehicle, cosmetic or both checks before buying.', href: vehicleServicePath('inspection', listing), icon: SearchCheck }] : []),
    ]
    return <section aria-label={`Services for ${listing.title}`} className="mt-5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
        <h3 className="font-bold text-lg text-[var(--text-primary)]">Services for this vehicle</h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{listing.title}</p>
        <div className="mt-3 grid gap-2">{items.map(({ title, description, href, icon: Icon }) => <Link key={title} href={href} className="flex items-start gap-3 rounded-lg border border-[var(--border-default)] p-3 hover:border-primary focus-visible:outline-2 focus-visible:outline-primary">
            <Icon size={20} className="mt-0.5 shrink-0 text-primary" />
            <span><span className="block font-bold text-[var(--text-primary)]">{title}</span><span className="mt-1 block text-sm leading-5 text-[var(--text-secondary)]">{description}</span></span>
        </Link>)}</div>
        {financeServiceEnabled && <p role="status" className="mt-3 text-sm text-[var(--text-muted)]">{finance?.id !== listing.id ? 'Checking finance availability…' : !finance.enabled ? 'Finance applications are not currently available for this vehicle.' : 'Finance approval is decided by the provider.'}</p>}
        <p className="mt-3 text-sm leading-5 text-[var(--text-muted)]">Vehicle details carry through to your request. Services are arranged separately from buying the vehicle; you pay the seller directly for the vehicle.</p>
    </section>
}
