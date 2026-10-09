import type { Signal, SignalKind, Window } from './types.ts';
import { ok, err } from './result.ts';
import type { Result } from './result.ts';

export const MAX_ACTIVE_SIGNALS = 5;
const KINDS: readonly SignalKind[] = ['scale_0_10', 'hours', 'count'];
const CADENCES = ['daily', 'weekly'] as const;
const WINDOWS: readonly Window[] = ['morning', 'evening', 'any'];

/** Offered during onboarding. The person (or their clinician) chooses; nothing is assumed. */
export const SIGNAL_SUGGESTIONS: ReadonlyArray<Omit<Signal, 'shared' | 'active'> & { why: string }> = [
  { id: 'sleep', label: 'Sleep', kind: 'hours', unit: 'h', higherIsBetter: true, cadence: 'daily', window: 'morning', why: 'Hours slept last night. Often worth watching alongside how the day feels.' },
  { id: 'anxiety', label: 'Anxiety', kind: 'scale_0_10', higherIsBetter: false, cadence: 'daily', window: 'evening', why: 'How anxious today felt, 0 to 10.' },
  { id: 'energy', label: 'Energy', kind: 'scale_0_10', higherIsBetter: true, cadence: 'daily', window: 'evening', why: 'How your energy was today, 0 to 10.' },
  { id: 'mood', label: 'Mood', kind: 'scale_0_10', higherIsBetter: true, cadence: 'daily', window: 'evening', why: 'Your overall mood today, 0 to 10.' },
];

export function slugId(label: string, taken: Set<string>): string {
  const base = 'sig_' + (label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'signal');
  let id = base;
  let i = 2;
  while (taken.has(id)) id = `${base}_${i++}`;
  return id;
}

export function activeCount(signals: Signal[]): number {
  return signals.filter((s) => s.active).length;
}

export interface NewSignalInput {
  label: string;
  kind: string;
  unit?: string;
  higherIsBetter: boolean;
  cadence: string;
  window: string;
}

export function validateNewSignal(existing: Signal[], input: NewSignalInput): Result<Signal> {
  const label = input.label.trim();
  if (label.length < 1 || label.length > 40) return err('Give the signal a short name (up to 40 characters).');
  if (existing.some((s) => s.label.toLowerCase() === label.toLowerCase())) return err('You already track something with that name.');
  if (activeCount(existing) >= MAX_ACTIVE_SIGNALS) return err(`You can track up to ${MAX_ACTIVE_SIGNALS} things at once. Pause one first.`);
  if (!(KINDS as readonly string[]).includes(input.kind)) return err('Unknown kind of signal.');
  if (!(CADENCES as readonly string[]).includes(input.cadence)) return err('Unknown cadence.');
  if (!(WINDOWS as readonly string[]).includes(input.window)) return err('Unknown time of day.');
  const unit = (input.unit ?? '').trim();
  if (unit.length > 10) return err('Unit is too long.');
  return ok({
    id: slugId(label, new Set(existing.map((s) => s.id))),
    label,
    kind: input.kind as SignalKind,
    unit: unit || undefined,
    higherIsBetter: input.higherIsBetter,
    cadence: input.cadence as 'daily' | 'weekly',
    window: input.window as Window,
    shared: false, // never shared by default
    active: true,
  });
}

export function canResume(signals: Signal[], id: string): Result<true> {
  const s = signals.find((x) => x.id === id);
  if (!s) return err('Unknown signal.');
  if (!s.active && activeCount(signals) >= MAX_ACTIVE_SIGNALS) return err(`You can track up to ${MAX_ACTIVE_SIGNALS} things at once. Pause another first.`);
  return ok(true);
}
