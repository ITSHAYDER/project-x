import type { Day, Insufficient } from '../types.ts';
import { addDays } from '../dates.ts';
import { median } from '../stats.ts';
import { CONFIG } from '../insights/config.ts';
import type { DayValue } from '../insights/series.ts';
import { window } from '../insights/series.ts';

export interface PrePost {
  status: 'ok';
  beforeMedian: number;
  afterMedian: number;
  nBefore: number;
  nAfter: number;
  diff: number;
  sourceRefs: string[];
}

/** Compare the N days before an intervention began with the N days after (descriptive only). */
export function prePost(series: DayValue[], startDay: Day, asOf: Day): PrePost | Insufficient {
  const n = CONFIG.prePostWindowDays;
  const before = window(series, addDays(startDay, -n), addDays(startDay, -1));
  const afterEnd = addDays(startDay, n - 1) < asOf ? addDays(startDay, n - 1) : asOf;
  const after = window(series, startDay, afterEnd);
  const need = CONFIG.prePostMinEntries;
  if (before.length < need || after.length < need) {
    return { status: 'insufficient', have: Math.min(before.length, after.length), need, unlocks: 'a before / after comparison' };
  }
  const b = median(before.map((p) => p.value));
  const a = median(after.map((p) => p.value));
  return {
    status: 'ok',
    beforeMedian: b,
    afterMedian: a,
    nBefore: before.length,
    nAfter: after.length,
    diff: a - b,
    sourceRefs: [...before, ...after].flatMap((p) => p.ids),
  };
}
