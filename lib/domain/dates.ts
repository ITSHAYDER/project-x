import type { Day } from './types.ts';

const MS = 86400000;

export function parseDay(d: Day): number {
  const [y, m, dd] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, dd);
}
export function formatDay(ms: number): Day {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
export function addDays(d: Day, n: number): Day {
  return formatDay(parseDay(d) + n * MS);
}
export function diffDays(a: Day, b: Day): number {
  // b - a in whole days
  return Math.round((parseDay(b) - parseDay(a)) / MS);
}
export function inRange(d: Day, from: Day, to: Day): boolean {
  return d >= from && d <= to; // ISO strings compare lexicographically
}
export function dayOfWeek(d: Day): number {
  return new Date(parseDay(d)).getUTCDay(); // 0 = Sunday
}
export function todayLocal(now: Date = new Date()): Day {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
export function prettyDay(d: Day): string {
  const dt = new Date(parseDay(d));
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function isValidTimezone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
/** The person's local calendar day at `now` (not the server's). */
export function todayIn(tz: string, now: Date = new Date()): Day {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
/** The person's local hour (0-23) at `now`. */
export function hourIn(tz: string, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  return Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
}
export function isDayString(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return formatDay(parseDay(d)) === d;
}
