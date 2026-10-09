import { pagePatient } from '@/lib/session';
import { prettyDay } from '@/lib/domain/dates';
import { todayIn } from '@/lib/domain/dates';
import { goalProgress, MAX_ACTIVE_GOALS, activeGoals } from '@/lib/domain/goals';
import { createGoalAction, toggleGoalStepAction, addGoalStepAction, setGoalStatusAction, setGoalSharedAction } from '@/app/actions';
import { ErrorNote, Section } from '@/components/Shell';
import { ShowcaseNote } from '@/components/ShowcaseNote';
import { nameOf } from '@/lib/data/store';
import type { FocusItem } from '@/lib/domain/types';

function GoalCard({ g, clinicianName }: { g: FocusItem; clinicianName: string | null }) {
  const pr = goalProgress(g);
  const mine = g.createdBy === 'patient';
  return (
    <li className="rounded-xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-serif text-lg">{g.title}</span>
        <span className="chip">{mine ? 'Your goal' : `Agreed with ${clinicianName ?? 'your clinician'}`}</span>
        {mine ? <span className="chip">{g.shared ? 'Shared with clinician' : '🔒 Only me'}</span> : null}
      </div>
      {g.why ? <p className="mt-1 font-serif text-muted">{g.why}</p> : null}
      <p className="mt-1 text-sm text-muted num">
        {pr.total > 0 ? `${pr.done} of ${pr.total} steps` : 'No steps yet'}
        {g.reviewDay ? ` · target ${prettyDay(g.reviewDay)}` : ''}
      </p>
      {pr.total > 0 ? (
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-accent-soft" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pr.pct} aria-label={`${g.title}: ${pr.done} of ${pr.total} steps done`}>
          <div className="h-full bg-accent" style={{ width: `${pr.pct}%` }} />
        </div>
      ) : null}
      <ul className="mt-3 space-y-1">
        {(g.steps ?? []).map((s) => (
          <li key={s.id}>
            <form action={toggleGoalStepAction} className="flex items-center gap-2">
              <input type="hidden" name="goalId" value={g.id} />
              <input type="hidden" name="stepId" value={s.id} />
              <button type="submit" className="btn" aria-pressed={s.done} aria-label={`${s.done ? 'Mark not done' : 'Mark done'}: ${s.text}`}>{s.done ? '✓' : '○'}</button>
              <span className={s.done ? 'text-muted line-through' : ''}>{s.text}</span>
            </form>
          </li>
        ))}
      </ul>
      {g.status === 'active' ? (
        <form action={addGoalStepAction} className="mt-3 flex gap-2">
          <input type="hidden" name="goalId" value={g.id} />
          <input className="field" name="text" maxLength={120} placeholder="Add a step" aria-label="Add a step" />
          <button className="btn" type="submit">Add</button>
        </form>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <form action={setGoalStatusAction}>
          <input type="hidden" name="goalId" value={g.id} />
          <input type="hidden" name="status" value={g.status === 'active' ? 'completed' : 'active'} />
          <button className="btn" type="submit">{g.status === 'active' ? 'Mark goal complete' : 'Reopen'}</button>
        </form>
        {mine ? (
          <form action={setGoalSharedAction}>
            <input type="hidden" name="goalId" value={g.id} />
            <input type="hidden" name="shared" value={String(!g.shared)} />
            <button className="btn" type="submit">{g.shared ? 'Make private' : 'Share with my clinician'}</button>
          </form>
        ) : null}
      </div>
    </li>
  );
}

export default function Goals({ searchParams }: { searchParams: { error?: string } }) {
  const { data } = pagePatient();
  const today = todayIn(data.timezone);
  const clinicianName = data.linkedClinicianId ? nameOf(data.linkedClinicianId) : null;
  const goals = data.focusItems.filter((f) => f.kind === 'goal');
  const active = goals.filter((g) => g.status === 'active');
  const done = goals.filter((g) => g.status === 'completed');
  const other = data.focusItems.filter((f) => f.kind !== 'goal' && f.status === 'active');
  return (
    <div>
      <ErrorNote error={searchParams.error} />
      <h1 className="font-serif text-2xl">Goals</h1>
      <p className="mt-1 text-muted">What you want to move toward, in your words, in steps small enough to start. Private unless you share it.</p>

      <Section title="Active" hint={`Up to ${MAX_ACTIVE_GOALS} at a time (${activeGoals(data.focusItems).length} now).`}>
        <ul className="space-y-4">
          {active.map((g) => <GoalCard key={g.id} g={g} clinicianName={clinicianName} />)}
          {active.length === 0 ? <li className="rounded-xl border border-line bg-card p-4 text-muted">No goals yet. Start with one small thing that would matter to you.</li> : null}
        </ul>
      </Section>

      <Section title="Add a goal" hint="One sentence, why it matters, and a few small steps. Steps are optional.">
        <form action={createGoalAction} className="grid gap-3 rounded-xl border border-line bg-card p-4">
          <div>
            <label className="label" htmlFor="gt">The goal</label>
            <input id="gt" className="field" name="title" maxLength={120} required placeholder="e.g. Reply to messages within a day" />
          </div>
          <div>
            <label className="label" htmlFor="gw">Why it matters to you (optional)</label>
            <input id="gw" className="field" name="why" maxLength={240} />
          </div>
          <div>
            <label className="label" htmlFor="gd">Target date (optional)</label>
            <input id="gd" className="field num" type="date" name="targetDay" min={today} />
          </div>
          <fieldset>
            <legend className="label">Small steps (optional)</legend>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <input key={i} className="field" name={`step${i}`} maxLength={120} aria-label={`Step ${i}`} placeholder={`Step ${i}`} />)}
            </div>
          </fieldset>
          <label className="chip w-fit"><input type="checkbox" name="shared" /> Share this goal with my clinician</label>
          <div><button className="btn btn-primary" type="submit">Add goal</button></div>
        </form>
      </Section>

      {other.length > 0 ? (
        <Section title="Other things you are working on">
          <ul className="space-y-2">{other.map((f) => <li key={f.id} className="flex items-center gap-2"><span className="chip">{f.kind}</span><span className="font-serif">{f.title}</span></li>)}</ul>
        </Section>
      ) : null}

      {done.length > 0 ? (
        <Section title="Completed">
          <ul className="space-y-4">{done.map((g) => <GoalCard key={g.id} g={g} clinicianName={clinicianName} />)}</ul>
        </Section>
      ) : null}
      <ShowcaseNote>
        Goals are the person&apos;s own. The clinician sees a goal only if it was made together or the patient shares it, and only its title and step progress, never anything private.
      </ShowcaseNote>
    </div>
  );
}
