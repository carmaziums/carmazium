import { apiClient } from './apiClient'

// ============================================================================
// TYPES
// ============================================================================

export interface FinanceApplication {
    id: string
    listingId: string
    userId: string
    partnerId: string
    depositAmount: string
    termMonths: number
    monthlyPayment: string | null
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
    approvalDate: string | null
    createdAt: string
    updatedAt: string
    listing?: {
        id: string
        title: string
        price: string
        slug: string
        images: string[]
        make: string | null
        model: string | null
        year: number | null
    }
    user?: {
        id: string
        firstName: string | null
        lastName: string | null
        email: string
    }
}

export interface InsuranceQuote {
    id: string
    listingId: string
    userId: string
    partnerId: string
    coverageType: string | null
    quotedPrice: string | null
    status: 'PENDING' | 'QUOTED' | 'ACCEPTED' | 'EXPIRED' | 'REJECTED'
    driverAge: number
    ncbYears: number
    hasConvictions: boolean
    expiryDate: string | null
    createdAt: string
    updatedAt: string
    listing?: {
        id: string
        title: string
        price: string
        slug: string
        images: string[]
        make: string | null
        model: string | null
        year: number | null
    }
    user?: {
        id: string
        firstName: string | null
        lastName: string | null
        email: string
    }
}

export interface PaginatedResponse<T> {
    data: T[]
    total: number
    page: number
    limit: number
}

export interface PartnerStats {
    pending: number
    approved: number
    rejected: number
    completed: number
    totalValue: number
}

export interface PartnerSettings {
    companyName: string
    callbackUrl: string
    isActive: boolean
    isConfigured: boolean
    apiKeyHint: string | null
    integrationEnabled: boolean
}

export interface RegeneratedPartnerKey {
    apiKey: string
    apiKeyHint: string
}

// ============================================================================
// FINANCE PARTNER API
// ============================================================================

export async function getFinanceApplications(page = 1, limit = 20): Promise<PaginatedResponse<FinanceApplication>> {
    const res = await apiClient<PaginatedResponse<FinanceApplication>>(
        `/finance/partner?page=${page}&limit=${limit}`
    )
    return res
}

export async function updateFinanceStatus(
    applicationId: string,
    status: string,
    monthlyPayment?: number
): Promise<FinanceApplication> {
    const body: any = { status }
    if (monthlyPayment !== undefined) body.monthlyPayment = monthlyPayment
    const res = await apiClient<{ data: FinanceApplication }>(`/finance/${applicationId}/status`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    })
    return res.data
}

export async function getFinanceStats(): Promise<PartnerStats> {
    const res = await apiClient<{ data: PartnerStats }>('/finance/partner/stats')
    return res.data
}

export async function getFinancePartnerSettings(): Promise<PartnerSettings> {
    const res = await apiClient<{ data: PartnerSettings }>('/finance/partner/settings')
    return res.data
}

export async function saveFinancePartnerSettings(input: { companyName: string; callbackUrl?: string | null }): Promise<PartnerSettings> {
    const res = await apiClient<{ data: PartnerSettings }>('/finance/partner/settings', {
        method: 'PATCH',
        body: JSON.stringify(input),
    })
    return res.data
}

export async function regenerateFinancePartnerKey(): Promise<RegeneratedPartnerKey> {
    const res = await apiClient<{ data: RegeneratedPartnerKey }>('/finance/partner/api-key/regenerate', {
        method: 'POST',
    })
    return res.data
}

// ============================================================================
// INSURANCE PARTNER API
// ============================================================================

export async function getInsuranceQuotes(page = 1, limit = 20): Promise<PaginatedResponse<InsuranceQuote>> {
    const res = await apiClient<PaginatedResponse<InsuranceQuote>>(
        `/insurance/partner?page=${page}&limit=${limit}`
    )
    return res
}

export async function updateInsuranceStatus(
    quoteId: string,
    status: string,
    quotedPrice?: number,
    coverageType?: string
): Promise<InsuranceQuote> {
    const body: any = { status }
    if (quotedPrice !== undefined) body.quotedPrice = quotedPrice
    if (coverageType) body.coverageType = coverageType
    const res = await apiClient<{ data: InsuranceQuote }>(`/insurance/${quoteId}/status`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    })
    return res.data
}

export async function getInsuranceStats(): Promise<PartnerStats> {
    const res = await apiClient<{ data: PartnerStats }>('/insurance/partner/stats')
    return res.data
}

export async function getInsurancePartnerSettings(): Promise<PartnerSettings> {
    const res = await apiClient<{ data: PartnerSettings }>('/insurance/partner/settings')
    return res.data
}

export async function saveInsurancePartnerSettings(input: { companyName: string; callbackUrl?: string | null }): Promise<PartnerSettings> {
    const res = await apiClient<{ data: PartnerSettings }>('/insurance/partner/settings', {
        method: 'PATCH',
        body: JSON.stringify(input),
    })
    return res.data
}

export async function regenerateInsurancePartnerKey(): Promise<RegeneratedPartnerKey> {
    const res = await apiClient<{ data: RegeneratedPartnerKey }>('/insurance/partner/api-key/regenerate', {
        method: 'POST',
    })
    return res.data
}

// ============================================================================
// HELPERS
// ============================================================================

export function formatCurrency(amount: number | string): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return '£0'
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(num)
}
