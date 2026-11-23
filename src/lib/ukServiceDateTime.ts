/**
 * Interpret rescheduling proposals as UK wall-clock time on web and Android,
 * regardless of the browser/phone timezone. A skipped spring DST hour fails
 * rather than silently moving the booking. In the repeated autumn hour we
 * choose the earlier occurrence consistently on both platforms.
 */
const ukClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function parseUkServiceDateTime(value: string, now = Date.now()): string | null {
  const raw = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(raw);
  const uk = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(raw);
  if (!iso && !uk) return null;

  const year = Number(iso ? iso[1] : uk![3]);
  const month = Number(iso ? iso[2] : uk![2]);
  const day = Number(iso ? iso[3] : uk![1]);
  const hour = Number(iso ? iso[4] : uk![4]);
  const minute = Number(iso ? iso[5] : uk![5]);
  if (year < 2020 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31
      || hour > 23 || minute > 59) return null;

  const utc = Date.UTC(year, month - 1, day, hour, minute);
  const candidates = [utc - 3_600_000, utc].filter(instant => {
    const parts = ukClock.formatToParts(new Date(instant));
    const field = (name: string) => Number(parts.find(part => part.type === name)?.value);
    return field('year') === year && field('month') === month
      && field('day') === day && field('hour') === hour && field('minute') === minute;
  });
  if (!candidates.length) return null;
  const instant = Math.min(...candidates);
  return instant > now ? new Date(instant).toISOString() : null;
}

export function formatUkServiceDateTime(value: string | null | undefined): string {
  if (!value) return 'As soon as possible';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? ukClock.format(date) + ' UK time' : 'Date unavailable';
}
