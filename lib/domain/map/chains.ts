import type { Day, Insufficient, Moment } from '../types.ts';
import { addDays, diffDays } from '../dates.ts';
import { CONFIG } from '../insights/config.ts';

export interface ChainEvidence {
  status: 'none' | 'emerging' | 'observed';
  moments: number;
  days: number;
  firstDay: Day | null;
  lastDay: Day | null;
  spanDays: number;
  momentIds: string[];
}

/** A -> B counts when a Moment's chain contains both with A before B. Evidence = distinct days. */
export function chainEdgeEvidence(moments: Moment[], from: string, to: string): ChainEvidence {
  const hits = moments.filter((m) => {
    const i = m.chain.indexOf(from);
    const j = m.chain.indexOf(to);
    return i !== -1 && j !== -1 && i < j;
  });
  const days = [...new Set(hits.map((m) => m.day))].sort();
  const first = days[0] ?? null;
  const last = days[days.length - 1] ?? null;
  const span = first && last ? diffDays(first, last) : 0;
  let status: ChainEvidence['status'] = 'none';
  if (days.length >= CONFIG.chainObservedDays && span >= CONFIG.chainObservedSpanDays) status = 'observed';
  else if (days.length >= CONFIG.chainEmergingDays) status = 'emerging';
  return { status, moments: hits.length, days: days.length, firstDay: first, lastDay: last, spanDays: span, momentIds: hits.map((m) => m.id) };
}

export interface ChainTrend {
  status: 'ok';
  recentRate: number;
  priorRate: number;
  direction: 'more' | 'less' | 'similar';
  recentMoments: number;
  priorMoments: number;
}

/** Rate = share of logged Moments that contain the link. Needs enough Moments in both periods. */
export function chainTrend(moments: Moment[], from: string, to: string, asOf: Day): ChainTrend | Insufficient {
  const w = CONFIG.chainTrendWindowDays;
  const recent = moments.filter((m) => m.day > addDays(asOf, -w) && m.day <= asOf);
  const prior = moments.filter((m) => m.day > addDays(asOf, -2 * w) && m.day <= addDays(asOf, -w));
  const need = CONFIG.chainTrendMinMoments;
  if (recent.length < need || prior.length < need) {
    return { status: 'insufficient', have: Math.min(recent.length, prior.length), need, unlocks: 'whether this link is showing up more or less often' };
  }
  const has = (m: Moment) => {
    const i = m.chain.indexOf(from);
    const j = m.chain.indexOf(to);
    return i !== -1 && j !== -1 && i < j;
  };
  const rr = recent.filter(has).length / recent.length;
  const pr = prior.filter(has).length / prior.length;
  const d = rr - pr;
  const direction = d >= CONFIG.chainTrendDiff ? 'more' : d <= -CONFIG.chainTrendDiff ? 'less' : 'similar';
  return { status: 'ok', recentRate: rr, priorRate: pr, direction, recentMoments: recent.length, priorMoments: prior.length };
}

/** Suggest adjacent links that appear on >= emerging days and are not already on the Map. */
export function proposeEdges(moments: Moment[], existing: Array<{ from: string; to: string }>): Array<{ from: string; to: string; days: number }> {
  const seen = new Map<string, Set<Day>>();
  for (const m of moments) {
    for (let i = 0; i < m.chain.length - 1; i++) {
      const k = `${m.chain[i]}>${m.chain[i + 1]}`;
      const s = seen.get(k) ?? new Set<Day>();
      s.add(m.day);
      seen.set(k, s);
    }
  }
  const have = new Set(existing.map((e) => `${e.from}>${e.to}`));
  const out: Array<{ from: string; to: string; days: number }> = [];
  for (const [k, days] of seen) {
    if (have.has(k) || days.size < CONFIG.chainEmergingDays) continue;
    const [from, to] = k.split('>');
    out.push({ from, to, days: days.size });
  }
  return out.sort((a, b) => b.days - a.days);
}
