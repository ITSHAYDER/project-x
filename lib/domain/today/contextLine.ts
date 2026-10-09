import type { Day, PatientData, Statement } from '../types.ts';
import { diffDays, prettyDay, dayOfWeek } from '../dates.ts';
import type { TodayPlan } from './scheduler.ts';

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface ContextLine {
  kind: 'after_session' | 'before_session' | 'focus_review' | 'change' | 'default';
  text: string;
}

/** Priority-ordered, template-based. No LLM. */
export function contextLine(data: PatientData, plan: TodayPlan, today: Day, changes: Statement[]): ContextLine {
  if (plan.mode === 'after_session' && plan.lastSessionDay) {
    const active = data.focusItems.filter((f) => f.status === 'active').slice(0, 1)[0];
    const what = active ? `We agreed to look at: ${active.title}.` : 'Take a moment to note what you are taking from it.';
    return { kind: 'after_session', text: `From ${DOW[dayOfWeek(plan.lastSessionDay)]}'s session. ${what}` };
  }
  if (plan.mode === 'before_session' && plan.nextSessionDay) {
    const n = data.agenda.filter((a) => a.status === 'open').length;
    const when = diffDays(today, plan.nextSessionDay) === 0 ? 'today' : DOW[dayOfWeek(plan.nextSessionDay)];
    return { kind: 'before_session', text: `Your session is ${when === 'today' ? 'today' : 'on ' + when}. ${n === 0 ? 'Nothing on your list to bring yet.' : n === 1 ? '1 thing you wanted to bring.' : `${n} things you wanted to bring.`}` };
  }
  const exp = data.focusItems.find((f) => f.status === 'active' && f.kind === 'experiment');
  if (exp) {
    const day = diffDays(exp.startDay, today) + 1;
    if (day >= 1 && day % 7 === 0) return { kind: 'focus_review', text: `Day ${day} of "${exp.title}".` };
  }
  const change = changes.find((s) => s.key === 'shift');
  if (change) return { kind: 'change', text: change.text };
  return { kind: 'default', text: `${DOW[dayOfWeek(today)]} ${prettyDay(today)}.` };
}
