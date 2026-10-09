import type { Day, FocusItem, Signal } from './types.ts';
import { addDays, diffDays, isDayString } from './dates.ts';
import { ok, err } from './result.ts';
import type { Result } from './result.ts';

const KINDS = ['hypothesis', 'experiment', 'goal', 'commitment'] as const;
const STATES = ['low', 'high'] as const;

export interface NewFocusInput {
  kind: string;
  title: string;
  startDay: string;
  reviewDay?: string;
  signalIds: string[];
  pair?: { a: string; b: string; aState: string; bState: string; lag: number };
}

export type FocusDraft = Omit<FocusItem, 'id' | 'createdBy' | 'status'>;

/**
 * `visibleSignals` MUST be the signals the author is allowed to see (for a clinician: shared and
 * consented). A hypothesis pair is declared BEFORE looking at the data and must name two different
 * visible signals, so patterns are tested on purpose, never fished for.
 */
export function validateNewFocus(visibleSignals: Signal[], today: Day, input: NewFocusInput): Result<FocusDraft> {
  const title = input.title.trim();
  if (title.length < 1 || title.length > 160) return err('Write the focus in one short sentence (up to 160 characters).');
  if (!(KINDS as readonly string[]).includes(input.kind)) return err('Unknown kind of focus.');
  const kind = input.kind as FocusItem['kind'];
  if (!isDayString(input.startDay)) return err('Start date is not valid.');
  if (Math.abs(diffDays(today, input.startDay)) > 30) return err('Start date must be within 30 days of today.');
  let reviewDay: Day | undefined;
  if (input.reviewDay) {
    if (!isDayString(input.reviewDay)) return err('Review date is not valid.');
    if (input.reviewDay < input.startDay) return err('Review date must be after the start date.');
    if (diffDays(input.startDay, input.reviewDay) > 365) return err('Review date is too far away.');
    reviewDay = input.reviewDay;
  }
  const visible = new Set(visibleSignals.map((s) => s.id));
  const ids = [...new Set(input.signalIds)].filter((x) => x);
  if (ids.some((id) => !visible.has(id))) return err('One of the signals is not shared with you.');
  if (ids.length > 3) return err('Link at most 3 signals.');

  let pair: FocusDraft['pair'];
  if (kind === 'hypothesis') {
    const p = input.pair;
    if (!p) return err('A hypothesis needs a pair of signals declared up front.');
    if (p.a === p.b) return err('Choose two different signals.');
    if (!visible.has(p.a) || !visible.has(p.b)) return err('Both signals must be ones the patient shares.');
    if (!(STATES as readonly string[]).includes(p.aState) || !(STATES as readonly string[]).includes(p.bState)) return err('Choose low or high for each signal.');
    if (p.lag !== 0 && p.lag !== 1) return err('Lag must be same day or next day.');
    pair = { a: p.a, b: p.b, aState: p.aState as 'low' | 'high', bState: p.bState as 'low' | 'high', lag: p.lag };
    for (const id of [p.a, p.b]) if (!ids.includes(id)) ids.push(id);
  } else if (kind === 'experiment') {
    if (ids.length !== 1) return err('An experiment tracks exactly one signal.');
  }
  return ok({ kind, title, startDay: input.startDay, reviewDay, signalIds: ids, pair });
}

export function defaultReviewDay(start: Day): Day {
  return addDays(start, 28);
}
