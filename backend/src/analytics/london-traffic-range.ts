/**
 * Date-only reporting windows for the UK admin dashboard.
 *
 * analytics_events.createdAt is a PostgreSQL timestamp without time zone,
 * written in UTC by Prisma. Convert London calendar boundaries to UTC instants
 * before passing them to the existing timestamp predicates.
 *
 * No dependency on the backend host's local timezone. Handles 23- and 25-hour
 * daylight-saving changeover days.
 */
import { BadRequestException } from '@nestjs/common';

const LONDON_DATE = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
});

function parts(date: Date) {
    const values: Record<string, number> = {};
    for (const part of LONDON_DATE.formatToParts(date)) {
        if (['year', 'month', 'day', 'hour', 'minute', 'second'].includes(part.type)) {
            values[part.type] = Number(part.value);
        }
    }
    return values;
}

export function londonDayString(date: Date): string {
    const p = parts(date);
    return [String(p.year).padStart(4, '0'), String(p.month).padStart(2, '0'), String(p.day).padStart(2, '0')].join('-');
}

function parseIsoDate(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new BadRequestException('Invalid analytics date: expected YYYY-MM-DD');
    }
    const utc = new Date(value + 'T00:00:00.000Z');
    if (!Number.isFinite(utc.getTime()) || utc.toISOString().slice(0, 10) !== value) {
        throw new BadRequestException('Invalid analytics calendar date');
    }
    return utc;
}

export function shiftIsoDate(value: string, days: number): string {
    const date = parseIsoDate(value);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function londonMidnightUtc(day: string): Date {
    const utcMidnight = parseIsoDate(day);
    const p = parts(utcMidnight);
    const representedAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const offsetMs = representedAsUtc - utcMidnight.getTime();
    return new Date(utcMidnight.getTime() - offsetMs);
}

/** Inclusive London date range expressed as an exclusive upper UTC boundary. */
export function londonTrafficRange(fromDay: string, toDay: string) {
    const from = parseIsoDate(fromDay);
    const to = parseIsoDate(toDay);
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
    if (days < 1 || days > 366) {
        throw new BadRequestException('Analytics date range must be between 1 and 366 days');
    }
    return {
        from: londonMidnightUtc(fromDay),
        untilExclusive: londonMidnightUtc(shiftIsoDate(toDay, 1)),
    };
}
