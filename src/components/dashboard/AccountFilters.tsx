import { ChevronDown } from 'lucide-react'
import type { AdminUserFilters } from '@/lib/adminApi'

export const SERVICE_LABELS: Record<string, string> = {
    DELIVERY: 'Collection, delivery & recovery',
    INSPECTION: 'Inspection',
    FINANCE: 'Finance',
    WARRANTY: 'Warranty',
}

const FILTERS: { key: keyof AdminUserFilters; label: string; all: string; options: [string, string][] }[] = [
    { key: 'accountType', label: 'Account type', all: 'All account types', options: [
        ['DEALER', 'Dealers'], ['SERVICE_PROVIDER', 'All service providers'],
        ['BUYER', 'Buyers'], ['SELLER', 'Sellers'], ['CONTRACTOR', 'Contractors'],
        ['FINANCE_PARTNER', 'Finance partners'], ['INSURANCE_PARTNER', 'Insurance partners'], ['ADMIN', 'Administrators'],
    ] },
    { key: 'dealerVerification', label: 'Dealer KYC', all: 'Any dealer verification', options: [
        ['VERIFIED', 'Verified dealers'], ['UNVERIFIED', 'All unverified dealers'],
        ['PENDING', 'KYC pending'], ['REJECTED', 'KYC rejected'], ['NOT_SUBMITTED', 'No KYC application'],
    ] },
    { key: 'serviceType', label: 'Service category', all: 'All service categories', options: Object.entries(SERVICE_LABELS) },
    { key: 'providerStatus', label: 'Service verification', all: 'Any service verification', options: [
        ['VERIFIED', 'Verified (current approval)'], ['UNVERIFIED', 'No current approval'],
        ['PENDING', 'Pending approval'], ['REJECTED', 'Rejected'], ['SUSPENDED', 'Suspended'],
        ['EXPIRED', 'Expired / reverification due'], ['NOT_SUBMITTED', 'Verification not submitted'],
    ] },
    { key: 'accountStatus', label: 'Account status', all: 'All account statuses', options: [
        ['ACTIVE', 'Active'], ['LOCKED', 'Locked'], ['BANNED', 'Banned'], ['DELETED', 'Deleted by user'],
    ] },
    { key: 'emailVerification', label: 'Email verification', all: 'Any email verification', options: [
        ['VERIFIED', 'Email verified'], ['UNVERIFIED', 'Email unverified'],
    ] },
]

export function AccountFilters({ filters, onChange, onClear, hasFilters }: {
    filters: AdminUserFilters;
    onChange: (key: keyof AdminUserFilters, value: string) => void;
    onClear: () => void;
    hasFilters: boolean;
}) {
    return <section aria-label="Account filters" className="space-y-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold text-base">Filter accounts</h2>
            {hasFilters && <button type="button" onClick={onClear} className="min-h-11 px-3 text-sm font-semibold text-primary underline underline-offset-4">Clear all filters</button>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {FILTERS.map(({ key, label, all, options }) => <label key={key} className="min-w-0 space-y-1.5 text-sm font-semibold">
                <span>{label}</span>
                <div className="relative">
                    <select value={filters[key] || ''} onChange={event => onChange(key, event.target.value)}
                        className="w-full min-w-0 min-h-11 appearance-none rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] pl-3 pr-9 py-2 text-base text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">{all}</option>
                        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                    </select>
                    <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
            </label>)}
        </div>
        <p className="text-sm text-[var(--text-muted)]">Filters work together across all accounts. Dealer KYC applies to dealers; service verification applies to the selected service, or any service if no category is selected. Email verification is separate.</p>
    </section>
}

export function AccountServices({ profile }: { profile?: { deletedAt?: string | null; businessName?: string | null; capabilities?: { serviceType: string; status: string; verificationStatus: string; verificationExpiresAt?: string | null }[] } | null }) {
    if (!profile || profile.deletedAt) return null
    return <div className="mt-2 space-y-1">
        {profile.businessName && <p className="text-sm text-[var(--text-muted)] break-words">{profile.businessName}</p>}
        <div className="flex flex-wrap gap-1">
            {profile.capabilities?.map(capability => {
                const verified = capability.status === 'APPROVED' && capability.verificationStatus === 'VERIFIED'
                    && !!capability.verificationExpiresAt && new Date(capability.verificationExpiresAt).getTime() > Date.now()
                const status = verified ? 'Verified' : capability.status === 'SUSPENDED' ? 'Suspended'
                    : capability.status === 'REJECTED' ? 'Rejected' : 'Unverified'
                return <span key={capability.serviceType} className="rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-xs text-[var(--text-primary)]">
                    {SERVICE_LABELS[capability.serviceType] || capability.serviceType} · {status}
                </span>
            })}
        </div>
    </div>
}
