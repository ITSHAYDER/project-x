import type { Day, Insufficient, Signal, ToolUse } from '../types.ts';
import { median } from '../stats.ts';
import { CONFIG } from '../insights/config.ts';
import type { DayValue } from '../insights/series.ts';

export interface ToolEvidence {
  status: 'ok';
  uses: number;
  betterWith: number;
  without: number;
  betterWithout: number;
  rateWith: number;
  rateWithout: number;
  verdict: 'more_often_better' | 'similar' | 'less_often_better';
}

/**
 * One pre-declared outcome per tool (same-day value of the outcome signal).
 * "Better" = better than the person's own median for that signal (direction-aware).
 * Pattern language only: this does not say the tool caused anything.
 */
export function toolEvidence(uses: ToolUse[], outcome: DayValue[], signal: Signal): ToolEvidence | Insufficient {
  const days = new Set<Day>(uses.map((u) => u.day));
  const med = median(outcome.map((p) => p.value));
  const better = (v: number) => (signal.higherIsBetter ? v > med : v < med);
  let withN = 0, withBetter = 0, withoutN = 0, withoutBetter = 0;
  for (const p of outcome) {
    if (days.has(p.day)) {
      withN++;
      if (better(p.value)) withBetter++;
    } else {
      withoutN++;
      if (better(p.value)) withoutBetter++;
    }
  }
  if (withN < CONFIG.toolMinUses || withoutN < CONFIG.toolMinWithout) {
    return { status: 'insufficient', have: withN, need: CONFIG.toolMinUses, unlocks: 'a comparison of days with and without this' };
  }
  const r1 = withBetter / withN;
  const r2 = withoutBetter / withoutN;
  const d = r1 - r2;
  const verdict = d >= CONFIG.toolDiff ? 'more_often_better' : d <= -CONFIG.toolDiff ? 'less_often_better' : 'similar';
  return { status: 'ok', uses: withN, betterWith: withBetter, without: withoutN, betterWithout: withoutBetter, rateWith: r1, rateWithout: r2, verdict };
}
