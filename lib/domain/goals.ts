import type { Day, FocusItem, GoalStep } from './types.ts';
import { diffDays, isDayString } from './dates.ts';
import { ok, err } from './result.ts';
import type { Result } from './result.ts';

export const MAX_ACTIVE_GOALS = 5;
export const MAX_STEPS = 8;

export type GoalDraft = Omit<FocusItem, 'id' | 'createdBy' | 'status'>;

export interface NewGoalInput {
  title: string;
  why?: string;
  targetDay?: string;
  steps: string[];
  shared: boolean;
}

export function activeGoals(items: FocusItem[]): FocusItem[] {
  return items.filter((f) => f.kind === 'goal' && f.status === 'active');
}

export function validateNewGoal(existing: FocusItem[], today: Day, input: NewGoalInput): Result<GoalDraft> {
  const title = input.title.trim();
  if (title.length < 1 || title.length > 120) return err('Write the goal in one short sentence (up to 120 characters).');
  if (activeGoals(existing).length >= MAX_ACTIVE_GOALS) return err(`You can have up to ${MAX_ACTIVE_GOALS} active goals. Finish or pause one first.`);
  if (existing.some((f) => f.kind === 'goal' && f.status === 'active' && f.title.toLowerCase() === title.toLowerCase())) return err('You already have a goal with that name.');
  const why = (input.why ?? '').trim();
  if (why.length > 240) return err('"Why it matters" is too long (up to 240 characters).');
  let target: Day | undefined;
  if (input.targetDay) {
    if (!isDayString(input.targetDay)) return err('Target date is not valid.');
    if (input.targetDay < today) return err('Target date cannot be in the past.');
    if (diffDays(today, input.targetDay) > 730) return err('Target date is too far away.');
    target = input.targetDay;
  }
  const texts = input.steps.map((s) => s.trim()).filter((s) => s.length > 0);
  if (texts.length > MAX_STEPS) return err(`Up to ${MAX_STEPS} steps.`);
  if (texts.some((s) => s.length > 120)) return err('Each step must be up to 120 characters.');
  const steps: GoalStep[] = texts.map((text, i) => ({ id: `gs${i + 1}`, text, done: false }));
  return ok({ kind: 'goal', title, why: why || undefined, startDay: today, reviewDay: target, signalIds: [], steps, shared: input.shared });
}

export interface GoalProgress {
  done: number;
  total: number;
  pct: number;
}
export function goalProgress(g: FocusItem): GoalProgress {
  const steps = g.steps ?? [];
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, pct: steps.length ? Math.round((done / steps.length) * 100) : 0 };
}

export function validateNewStep(g: FocusItem, text: string): Result<GoalStep> {
  const t = text.trim();
  if (t.length < 1 || t.length > 120) return err('Write the step in a few words (up to 120 characters).');
  const steps = g.steps ?? [];
  if (steps.length >= MAX_STEPS) return err(`Up to ${MAX_STEPS} steps.`);
  let n = steps.length + 1;
  while (steps.some((s) => s.id === `gs${n}`)) n++;
  return ok({ id: `gs${n}`, text: t, done: false });
}
