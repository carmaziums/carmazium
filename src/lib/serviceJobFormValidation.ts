export type JobFormIssue = { field: string; message: string };
export function jobVehicleIdentified(vehicle: { registration?: string | null; make?: string | null; model?: string | null }) {
    return !!(vehicle.registration?.trim() || (vehicle.make?.trim() && vehicle.model?.trim()));
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
