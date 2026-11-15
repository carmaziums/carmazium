export interface ListingInputIssue { field: string; label: string; message: string }

/** Validate values before parsing; parseInt silently truncates fractional inputs. */
export function listingDetailsInputIssue(data: {
    vrm: string; year: string; mileage: string; title: string
    doors?: string; seats?: string; vehicleType?: string; bodyType?: string
}, currentYear = new Date().getFullYear()): ListingInputIssue | null {
    const vrm = data.vrm.replace(/\s/g, '').toUpperCase()
    if (data.vrm && !/^[A-Z0-9]{2,7}$/.test(vrm)) {
        return { field: 'registration', label: 'Registration', message: 'Enter a valid registration using 2–7 letters and numbers.' }
    }
    if (data.year && (!/^\d{4}$/.test(data.year) || Number(data.year) < 1900 || Number(data.year) > currentYear + 1)) {
        return { field: 'year', label: 'Year', message: `Enter a whole year between 1900 and ${currentYear + 1}.` }
    }
    if (data.mileage && (!/^\d+$/.test(data.mileage) || !Number.isSafeInteger(Number(data.mileage)) || Number(data.mileage) > 2147483647)) {
        return { field: 'mileage', label: 'Mileage', message: 'Enter a whole mileage of zero or more, without decimals or a minus sign.' }
    }
    if (data.title && (data.title.trim().length < 5 || data.title.length > 200)) {
        return { field: 'title', label: 'Listing Title', message: 'Enter a listing title between 5 and 200 characters.' }
    }
    if (data.vehicleType !== 'MOTORCYCLE' && data.bodyType !== 'CARAVAN') {
        for (const [field, label, min, max] of [['doors', 'Doors', 2, 8], ['seats', 'Seats', 1, 20]] as const) {
            const value = data[field]?.trim() ?? ''
            if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) {
                return { field, label, message: `Enter the number of ${field} as a whole number between ${min} and ${max}.` }
            }
        }
    }
    return null
}

export function isValidListingPrice(value: string): boolean {
    return /^\d+(\.\d{1,2})?$/.test(value.trim()) && Number.isFinite(Number(value)) && Number(value) > 0
}
