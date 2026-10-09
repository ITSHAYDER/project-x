import type { Day, Insufficient, Signal } from '../types.ts';
import { addDays, diffDays } from '../dates.ts';
import { median, quantile } from '../stats.ts';
import { CONFIG } from '../insights/config.ts';
import type { DayValue } from '../insights/series.ts';
import { window } from '../insights/series.ts';

export interface HarderPeriod {
  onset: Day;
  end: Day;
  length: number;
}

/**
 * "Harder period" = the person's anchor signal is in its worse quartile (their own P25 or P75)
 * on >= 3 consecutive calendar days. Periods closer than 7 days are merged.
 */
export function findHarderPeriods(anchor: DayValue[], higherIsBetter: boolean): HarderPeriod[] {
  if (anchor.length === 0) return [];
  const vals = anchor.map((p) => p.value);
  const lo = quantile(vals, 0.25);
  const hi = quantile(vals, 0.75);
  const worse = (v: number) => (higherIsBetter ? v <= lo : v >= hi);
  const runs: HarderPeriod[] = [];
  let start: Day | null = null;
  let prev: Day | null = null;
  const flush = () => {
    if (start && prev) {
      const len = diffDays(start, prev) + 1;
      if (len >= CONFIG.earlySignHarderMinRun) runs.push({ onset: start, end: prev, length: len });
    }
    start = null;
    prev = null;
  };
  for (const p of anchor) {
    const isWorse = worse(p.value);
    if (isWorse && prev && diffDays(prev, p.day) === 1) {
      prev = p.day;
    } else if (isWorse) {
      flush();
      start = p.day;
      prev = p.day;
    } else {
      flush();
    }
  }
  flush();
  // merge periods closer than 7 days
  const merged: HarderPeriod[] = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && diffDays(last.end, r.onset) < 7) {
      last.end = r.end;
      last.length = diffDays(last.onset, last.end) + 1;
    } else merged.push({ ...r });
  }
  return merged;
}

export interface EarlySign {
  signalId: string;
  direction: 'lower' | 'higher';
  periodsShifted: number;
  periodsEvaluated: number;
  medianLeadDays: number;
  label: 'tentative' | 'candidate';
}

export interface EarlySignResult {
  status: 'ok';
  periods: HarderPeriod[];
  signs: EarlySign[];
}

/**
 * Retrospective only: for each past harder period, which other signals had already moved beyond
 * the person's own usual range in the 7 days before onset? Never a prediction.
 */
export function earlySigns(
  anchorSignal: Signal,
  anchor: DayValue[],
  others: Array<{ signal: Signal; series: DayValue[] }>,
  asOf: Day,
): EarlySignResult | Insufficient {
  const span = anchor.length ? diffDays(anchor[0].day, asOf) + 1 : 0;
  if (span < CONFIG.earlySignMinDataDays) {
    return { status: 'insufficient', have: Math.max(span, 0), need: CONFIG.earlySignMinDataDays, unlocks: 'looking back at what moved before harder periods', unit: 'days of data' };
  }
  const periods = findHarderPeriods(anchor, anchorSignal.higherIsBetter);
  if (periods.length < CONFIG.earlySignMinPeriods) {
    return { status: 'insufficient', have: periods.length, need: CONFIG.earlySignMinPeriods, unlocks: 'looking back at what moved before harder periods', unit: 'harder periods' };
  }
  const signs: EarlySign[] = [];
  for (const o of others) {
    if (o.signal.id === anchorSignal.id) continue;
    const vals = o.series.map((p) => p.value);
    if (vals.length < 10) continue;
    const med = median(vals);
    const step = Math.max((quantile(vals, 0.75) - quantile(vals, 0.25)) * CONFIG.earlySignStepFactor, CONFIG.minStep[o.signal.kind] ?? 1);
    for (const dir of ['lower', 'higher'] as const) {
      let evaluated = 0;
      let shifted = 0;
      const leads: number[] = [];
      for (const p of periods) {
        const w = window(o.series, addDays(p.onset, -CONFIG.earlySignLookbackDays), addDays(p.onset, -1));
        if (w.length < CONFIG.earlySignMinEntriesInWindow) continue;
        evaluated++;
        const beyond = w.filter((x) => (dir === 'lower' ? x.value < med - step : x.value > med + step));
        if (beyond.length >= CONFIG.earlySignMinBeyond) {
          shifted++;
          leads.push(diffDays(beyond[0].day, p.onset));
        }
      }
      if (evaluated >= CONFIG.earlySignMinPeriods && shifted >= CONFIG.earlySignMinPeriods && shifted / evaluated >= CONFIG.earlySignMinShare) {
        signs.push({
          signalId: o.signal.id,
          direction: dir,
          periodsShifted: shifted,
          periodsEvaluated: evaluated,
          medianLeadDays: median(leads),
          label: evaluated >= CONFIG.earlySignCandidatePeriods ? 'candidate' : 'tentative',
        });
      }
    }
  }
  signs.sort((a, b) => b.periodsShifted / b.periodsEvaluated - a.periodsShifted / a.periodsEvaluated);
  return { status: 'ok', periods, signs };
}
