function record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function notificationEmailsEnabled(preferences: unknown): boolean {
    return record(record(preferences).notifications).email !== false;
}
/** Patch only the email channel while preserving every other notification option. */
export function notificationEmailPatch(preferences: unknown, enabled: boolean) {
    return { notifications: { ...record(record(preferences).notifications), email: enabled } };
}
