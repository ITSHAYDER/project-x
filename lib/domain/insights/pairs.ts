import type { Day, Insufficient } from '../types.ts';
import { addDays } from '../dates.ts';
import { quantile } from '../stats.ts';
import { CONFIG } from './config.ts';
import type { DayValue } from './series.ts';
import { toMap } from './series.ts';

export type State = 'low' | 'high';

export interface PairEvidence {
  status: 'ok';
  nPairs: number;
  aStateDays: number; // days where A was in its state
  bWhenA: number; // of those, days where B was in its state
  otherDays: number;
  bWhenOther: number;
  rateWhenA: number;
  rateWhenOther: number;
  verdict: 'present' | 'weak' | 'not_seen';
  sourceRefs: string[];
}

function inState(v: number, lo: number, hi: number, s: State): boolean {
  return s === 'low' ? v <= lo : v >= hi;
}

/**
 * Pre-declared pair evidence. Thresholds are the person's own P25/P75 over the analysis window.
 * This describes a pattern in reported data. It is never presented as a cause.
 */
export function pairEvidence(
  a: DayValue[],
  b: DayValue[],
  aState: State,
  bState: State,
  lag: 0 | 1,
  from: Day,
  to: Day,
): PairEvidence | Insufficient {
  const aw = a.filter((p) => p.day >= from && p.day <= to);
  const bw = b.filter((p) => p.day >= from && p.day <= to);
  const bMap = toMap(bw);
  const aVals = aw.map((p) => p.value);
  const bVals = bw.map((p) => p.value);
  if (aVals.length === 0 || bVals.length === 0) {
    return { status: 'insufficient', have: 0, need: CONFIG.pairMinPairs, unlocks: 'a look at whether these two move together' };
  }
  const aLo = quantile(aVals, 0.25);
  const aHi = quantile(aVals, 0.75);
  const bLo = quantile(bVals, 0.25);
  const bHi = quantile(bVals, 0.75);

  let aState_n = 0, aState_b = 0, other_n = 0, other_b = 0;
  const refs: string[] = [];
  let pairs = 0;
  for (const p of aw) {
    const q = bMap.get(addDays(p.day, lag));
    if (!q) continue;
    pairs++;
    const aIn = inState(p.value, aLo, aHi, aState);
    const bIn = inState(q.value, bLo, bHi, bState);
    if (aIn) {
      aState_n++;
      if (bIn) aState_b++;
      refs.push(...p.ids, ...q.ids);
    } else {
      other_n++;
      if (bIn) other_b++;
    }
  }
  if (pairs < CONFIG.pairMinPairs) {
    return { status: 'insufficient', have: pairs, need: CONFIG.pairMinPairs, unlocks: 'a look at whether these two move together' };
  }
  if (aState_n < CONFIG.pairMinSubgroup || other_n < CONFIG.pairMinSubgroup) {
    return { status: 'insufficient', have: Math.min(aState_n, other_n), need: CONFIG.pairMinSubgroup, unlocks: 'a fair comparison between the two kinds of days' };
  }
  const r1 = aState_b / aState_n;
  const r2 = other_b / other_n;
  const d = r1 - r2;
  const verdict = d >= CONFIG.pairPresentDiff ? 'present' : d >= CONFIG.pairWeakDiff ? 'weak' : 'not_seen';
  return {
    status: 'ok',
    nPairs: pairs,
    aStateDays: aState_n,
    bWhenA: aState_b,
    otherDays: other_n,
    bWhenOther: other_b,
    rateWhenA: r1,
    rateWhenOther: r2,
    verdict,
    sourceRefs: refs,
  };
}
