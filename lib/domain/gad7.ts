// GAD-7 (Generalized Anxiety Disorder 7-item scale; Spitzer, Williams, Kroenke and colleagues).
// Widely used, and published as free to reproduce and use. Please confirm the current licensing terms
// for your use before relying on this text. This product shows the TOTAL and how it changed for the
// person. It deliberately shows NO severity label and makes no diagnostic statement: a questionnaire
// score is a conversation starter, not a verdict. A clinician decides what it means.
import type { Assessment, Day } from './types.ts';
import { ok, err } from './result.ts';
import type { Result } from './result.ts';

export const GAD7_PROMPT = 'Over the last 2 weeks, how often have you been bothered by the following problems?';
export const GAD7_ITEMS: readonly string[] = [
  'Feeling nervous, anxious, or on edge',
  'Not being able to stop or control worrying',
  'Worrying too much about different things',
  'Trouble relaxing',
  'Being so restless that it is hard to sit still',
  'Becoming easily annoyed or irritable',
  'Feeling afraid, as if something awful might happen',
];
export const GAD7_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half the days' },
  { value: 3, label: 'Nearly every day' },
];

export function scoreGad7(answers: number[]): Result<number> {
  if (answers.length !== GAD7_ITEMS.length) return err('Please answer every question.');
  if (answers.some((a) => !Number.isInteger(a) || a < 0 || a > 3)) return err('Answers must be between 0 and 3.');
  return ok(answers.reduce((a, b) => a + b, 0));
}

export function newGad7(answers: number[], day: Day, id: string): Result<Assessment> {
  const t = scoreGad7(answers);
  if (!t.ok) return err(t.error);
  return ok({ id, kind: 'gad7', day, answers, total: t.value });
}

export interface Gad7Change {
  latest: Assessment;
  previous: Assessment | null;
  diff: number | null;
}
export function gad7Change(results: Assessment[]): Gad7Change | null {
  const r = results.filter((x) => x.kind === 'gad7').sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.id < b.id ? -1 : 1));
  if (r.length === 0) return null;
  const latest = r[r.length - 1];
  const previous = r.length > 1 ? r[r.length - 2] : null;
  return { latest, previous, diff: previous ? latest.total - previous.total : null };
}
