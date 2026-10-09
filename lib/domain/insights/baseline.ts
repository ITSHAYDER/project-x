import type { Day, Insufficient, Signal } from '../types.ts';
import { addDays, diffDays } from '../dates.ts';
import { median, quantile } from '../stats.ts';
import { CONFIG } from './config.ts';
import { window, lastDays } from './series.ts';
import type { DayValue } from './series.ts';

export interface Baseline {
  status: 'ok';
  median: number;
  q1: number;
  q3: number;
  iqr: number;
  n: number;
  from: Day;
  to: Day;
}

/** Earliest day a baseline becomes possible if the person keeps logging daily. */
export function readyOn(series: DayValue[], asOf: Day): Day {
  const first = series.length ? series[0].day : asOf;
  const needDays = Math.max(CONFIG.baselineMinEntries, CONFIG.baselineMinSpanDays + 1) - 1 + CONFIG.baselineGapDays;
  const d = addDays(first, needDays + 1);
  return d < asOf ? asOf : d;
}

export function computeBaseline(series: DayValue[], asOf: Day): Baseline | Insufficient {
  const to = addDays(asOf, -CONFIG.baselineGapDays);
  const from = addDays(to, -(CONFIG.baselineWindowDays - 1));
  const w = window(series, from, to);
  const need = CONFIG.baselineMinEntries;
  if (w.length < need) {
    return { status: 'insufficient', have: w.length, need, unlocks: 'what is usual for you, so changes can be spotted', readyOn: readyOn(series, asOf) };
  }
  const span = diffDays(w[0].day, w[w.length - 1].day);
  if (span < CONFIG.baselineMinSpanDays) {
    return { status: 'insufficient', have: span + 1, need: CONFIG.baselineMinSpanDays + 1, unlocks: 'what is usual for you, so changes can be spotted', readyOn: readyOn(series, asOf) };
  }
  const vals = w.map((p) => p.value);
  const q1 = quantile(vals, 0.25);
  const q3 = quantile(vals, 0.75);
  return { status: 'ok', median: median(vals), q1, q3, iqr: q3 - q1, n: w.length, from, to };
}

export interface Shift {
  signalId: string;
  direction: 'lower' | 'higher';
  current: number;
  usual: number;
  sideCount: number;
  of: number;
  sourceRefs: string[];
}

export function detectShift(signal: Signal, series: DayValue[], asOf: Day): Shift | null {
  const b = computeBaseline(series, asOf);
  if (b.status !== 'ok') return null;
  const recent = lastDays(series, asOf, CONFIG.shiftWindowDays);
  if (recent.length < CONFIG.shiftMinEntries) return null;
  const cur = median(recent.map((p) => p.value));
  const step = Math.max(b.iqr, CONFIG.minStep[signal.kind] ?? 1);
  if (Math.abs(cur - b.median) <= step) return null;
  const direction = cur < b.median ? 'lower' : 'higher';
  const side = recent.filter((p) => (direction === 'lower' ? p.value < b.median : p.value > b.median)).length;
  if (side < CONFIG.shiftMinSameSide) return null;
  return {
    signalId: signal.id,
    direction,
    current: cur,
    usual: b.median,
    sideCount: side,
    of: recent.length,
    sourceRefs: recent.flatMap((p) => p.ids),
  };
}

export interface PeriodComparison {
  status: 'ok';
  signalId: string;
  thisMedian: number;
  lastMedian: number;
  nThis: number;
  nLast: number;
  diff: number;
}

export function comparePeriods(signalId: string, series: DayValue[], asOf: Day): PeriodComparison | Insufficient {
  const thisW = lastDays(series, asOf, 7);
  const lastW = window(series, addDays(asOf, -13), addDays(asOf, -7));
  const need = CONFIG.compareMinEntries;
  if (thisW.length < need || lastW.length < need) {
    return { status: 'insufficient', have: Math.min(thisW.length, lastW.length), need, unlocks: 'a week-to-week comparison' };
  }
  const a = median(thisW.map((p) => p.value));
  const b = median(lastW.map((p) => p.value));
  return { status: 'ok', signalId, thisMedian: a, lastMedian: b, nThis: thisW.length, nLast: lastW.length, diff: a - b };
}
