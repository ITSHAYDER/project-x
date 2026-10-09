import type { Day, Insufficient, PatientData } from '../types.ts';
import { addDays } from '../dates.ts';
import { quantile } from '../stats.ts';
import { seriesOf } from '../insights/series.ts';

export interface SituationCount {
  label: string;
  onHigher: number;
  higherDays: number;
  onOther: number;
  otherDays: number;
}
export interface AnxietyContext {
  status: 'ok';
  higherDays: number;
  otherDays: number;
  situations: SituationCount[];
}

const MIN_DAYS_EACH = 8;

/**
 * Descriptive only: which situations were logged on the person's higher-anxiety days
 * (their own top quartile over the last 84 days) versus their other days. Counts, never a cause.
 */
export function anxietyContext(d: PatientData, asOf: Day, signalId = 'anxiety'): AnxietyContext | Insufficient {
  const series = seriesOf(d.entries, signalId).filter((p) => p.day > addDays(asOf, -84) && p.day <= asOf);
  const unlocks = 'a look at which situations show up on your higher-anxiety days';
  if (series.length < 2 * MIN_DAYS_EACH) return { status: 'insufficient', have: series.length, need: 2 * MIN_DAYS_EACH, unlocks, unit: 'days with a rating' };
  const hi = quantile(series.map((p) => p.value), 0.75);
  const higher = new Set(series.filter((p) => p.value >= hi).map((p) => p.day));
  const other = new Set(series.filter((p) => p.value < hi).map((p) => p.day));
  if (higher.size < MIN_DAYS_EACH || other.size < MIN_DAYS_EACH) return { status: 'insufficient', have: Math.min(higher.size, other.size), need: MIN_DAYS_EACH, unlocks, unit: 'days in each group' };
  const nodeById = new Map(d.nodes.map((n) => [n.id, n]));
  const perHigher = new Map<string, Set<Day>>();
  const perOther = new Map<string, Set<Day>>();
  for (const m of d.moments) {
    const bucket = higher.has(m.day) ? perHigher : other.has(m.day) ? perOther : null;
    if (!bucket) continue;
    for (const id of m.chain) {
      const n = nodeById.get(id);
      if (!n || n.kind !== 'situation') continue;
      const set = bucket.get(id) ?? new Set<Day>();
      set.add(m.day);
      bucket.set(id, set);
    }
  }
  const out: SituationCount[] = [];
  for (const [id, days] of perHigher) {
    if (days.size < 2) continue;
    out.push({ label: nodeById.get(id)!.label, onHigher: days.size, higherDays: higher.size, onOther: perOther.get(id)?.size ?? 0, otherDays: other.size });
  }
  out.sort((a, b) => b.onHigher / b.higherDays - b.onOther / b.otherDays - (a.onHigher / a.higherDays - a.onOther / a.otherDays));
  return { status: 'ok', higherDays: higher.size, otherDays: other.size, situations: out.slice(0, 3) };
}
