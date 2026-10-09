import type { Day, PatientData, Signal } from '../types.ts';
import { diffDays } from '../dates.ts';
import { computeBaseline } from '../insights/baseline.ts';
import { seriesOf } from '../insights/series.ts';

export type Mode = 'normal' | 'before_session' | 'after_session' | 'quiet';
export interface Ask {
  signalId: string;
  reason: string;
}
export interface TodayPlan {
  mode: Mode;
  window: 'morning' | 'evening';
  asks: Ask[];
  focusDue: string[];
  nextSessionDay: Day | null;
  lastSessionDay: Day | null;
}

export interface SchedulerPrefs {
  maxAsks: number;
  quiet: boolean;
  morningUntilHour: number;
}
export const DEFAULT_PREFS: SchedulerPrefs = { maxAsks: 3, quiet: false, morningUntilHour: 12 };

function lastAnswered(data: PatientData, signalId: string): Day | null {
  let last: Day | null = null;
  for (const e of data.entries) if (e.signalId === signalId && (!last || e.day > last)) last = e.day;
  return last;
}

/** Deterministic: same inputs, same plan. Returns the reason for every ask so it can be disclosed. */
export function planToday(data: PatientData, today: Day, hour: number, prefs: SchedulerPrefs = DEFAULT_PREFS): TodayPlan {
  const window = hour < prefs.morningUntilHour ? 'morning' : 'evening';
  const upcoming = data.sessions.filter((s) => !s.occurred && s.day >= today).sort((a, b) => (a.day < b.day ? -1 : 1))[0];
  const past = data.sessions.filter((s) => s.occurred && s.day <= today).sort((a, b) => (a.day < b.day ? 1 : -1))[0];
  const nextSessionDay = upcoming?.day ?? null;
  const lastSessionDay = past?.day ?? null;

  let mode: Mode = 'normal';
  if (prefs.quiet) mode = 'quiet';
  else if (lastSessionDay && diffDays(lastSessionDay, today) <= 1) mode = 'after_session';
  else if (nextSessionDay && diffDays(today, nextSessionDay) <= 2) mode = 'before_session';

  const focusDue = data.focusItems
    .filter((f) => f.status === 'active' && (f.kind === 'commitment' || f.kind === 'experiment') && !data.focusChecks.some((c) => c.focusId === f.id && c.day === today))
    .map((f) => f.id);

  if (mode === 'quiet') return { mode, window, asks: [], focusDue: [], nextSessionDay, lastSessionDay };

  const candidates: Array<{ s: Signal; score: number; reason: string }> = [];
  for (const s of data.signals) {
    if (!s.active) continue;
    if (s.window !== 'any' && s.window !== window) continue;
    const last = lastAnswered(data, s.id);
    if (last === today) continue; // already answered in this window/day
    if (s.cadence === 'weekly' && last && diffDays(last, today) < 7) continue;
    const series = seriesOf(data.entries, s.id);
    const base = computeBaseline(series, today);
    const learning = base.status !== 'ok';
    const count = series.length;
    const focusLinked = data.focusItems.some((f) => f.status === 'active' && f.signalIds.includes(s.id));
    let score = 1;
    let reason = 'part of your usual check-in';
    if (learning) {
      score += 3;
      reason = `still learning your usual (${count} ${count === 1 ? 'day' : 'days'} so far)`;
    }
    if (focusLinked) {
      score += 2;
      if (!learning) reason = 'linked to something you are working on';
    }
    // gentle fatigue rule: 3 skipped days in a row -> ask every other day
    const skipped = last ? diffDays(last, today) : 0;
    if (s.cadence === 'daily' && last && skipped >= 3 && skipped % 2 === 1) score -= 1;
    candidates.push({ s, score, reason });
  }
  candidates.sort((a, b) => b.score - a.score || a.s.label.localeCompare(b.s.label));
  const asks = candidates.slice(0, prefs.maxAsks).map((c) => ({ signalId: c.s.id, reason: c.reason }));
  return { mode, window, asks, focusDue, nextSessionDay, lastSessionDay };
}
