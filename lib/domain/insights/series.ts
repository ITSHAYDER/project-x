import type { Day, SignalEntry } from '../types.ts';
import { addDays, inRange } from '../dates.ts';

export interface DayValue {
  day: Day;
  value: number;
  ids: string[];
}

/** One value per day (mean if several entries share a day), sorted by day. */
export function seriesOf(entries: SignalEntry[], signalId: string): DayValue[] {
  const by = new Map<Day, { sum: number; n: number; ids: string[] }>();
  for (const e of entries) {
    if (e.signalId !== signalId) continue;
    const cur = by.get(e.day) ?? { sum: 0, n: 0, ids: [] };
    cur.sum += e.value;
    cur.n += 1;
    cur.ids.push(e.id);
    by.set(e.day, cur);
  }
  return [...by.entries()]
    .map(([day, v]) => ({ day, value: v.sum / v.n, ids: v.ids }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
}

export function window(series: DayValue[], from: Day, to: Day): DayValue[] {
  return series.filter((p) => inRange(p.day, from, to));
}

/** Last N calendar days ending at asOf (inclusive). */
export function lastDays(series: DayValue[], asOf: Day, n: number): DayValue[] {
  return window(series, addDays(asOf, -(n - 1)), asOf);
}

export function toMap(series: DayValue[]): Map<Day, DayValue> {
  return new Map(series.map((p) => [p.day, p]));
}
