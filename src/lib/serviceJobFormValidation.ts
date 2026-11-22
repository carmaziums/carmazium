export type JobFormIssue = { field: string; message: string };
export function jobVehicleIdentified(vehicle: { registration?: string | null; make?: string | null; model?: string | null }) {
    return !!(vehicle.registration?.trim() || (vehicle.make?.trim() && vehicle.model?.trim()));
}
/** Shared website rule matching the native TradeXchange job form. */
export function jobPostcodeValid(value: string) {
    return /^[A-Z]{1,2}\\d[A-Z\\d]?\\s*\\d[A-Z]{2}$/i.test(value.trim());
}
export function jobYearValid(year: number | string | null | undefined) {
    return year == null || year === "" || (/^\\d{4}$/.test(String(year)) &&
        Number(year) >= 1900 && Number(year) <= 2100);
}
export function jobDateIssue(value: string, required: boolean, now = Date.now()): JobFormIssue | null {
    if (!value) return required ? { field: 'job-date', message: 'Choose a date and time, or select As soon as possible.' } : null;
    const date = new Date(value).getTime();
    return !Number.isFinite(date) || date <= now ? { field: 'job-date', message: 'Choose a date and time in the future.' } : null;
}
export function focusJobFormIssue(field: string) {
    const element = document.getElementById(field);
    element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    element?.focus({ preventScroll: true });
}
