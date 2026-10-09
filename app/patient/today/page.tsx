import Link from 'next/link';
import { pagePatient } from '@/lib/session';
import { todayIn, hourIn, prettyDay } from '@/lib/domain/dates';
import { planToday } from '@/lib/domain/today/scheduler';
import { contextLine } from '@/lib/domain/today/contextLine';
import { computeBrief } from '@/lib/domain/insights/brief';
import { computeBaseline } from '@/lib/domain/insights/baseline';
import { seriesOf, lastDays } from '@/lib/domain/insights/series';
import { ScalePrompt } from '@/components/ScalePrompt';
import { Sparkline } from '@/components/Sparkline';
import { ErrorNote, Section } from '@/components/Shell';
import { StatementList } from '@/components/StatementList';
import { focusCheck, focusNotDone, addAgendaAction, savePatientRecapNote, agendaStatusAction, agendaShareAction } from '@/app/actions';
import { ShowcaseNote } from '@/components/ShowcaseNote';
import { getStore } from '@/lib/data/store';

const OBSTACLES = ['tired', 'no time', 'forgot', 'felt too hard', "didn't seem useful"];

export default function Today({ searchParams }: { searchParams: { error?: string } }) {
  const { actor, data } = pagePatient();
  const today = todayIn(data.timezone);
  const hour = hourIn(data.timezone);
  const plan = planToday(data, today, hour);
  const brief = computeBrief(data, { role: 'patient', patientId: actor.id }, today);
  const changes = brief.statements.filter((s) => s.section === 'changed');
  const ctx = contextLine(data, plan, today, changes);
  const answeredToday = data.signals.filter((s) => data.entries.some((e) => e.signalId === s.id && e.day === today));
  const focusToday = data.focusItems.filter((f) => f.status === 'active' && (f.kind === 'commitment' || f.kind === 'experiment'));
  const openAgenda = data.agenda.filter((a) => a.status === 'open');
  const recaps = getStore().recaps.get(data.patientId) ?? [];
  const lastRecap = recaps[recaps.length - 1];
  const learning = brief.notes[0];
  const nothingLeft = plan.asks.length === 0 && plan.focusDue.length === 0;

  return (
    <div>
      <ErrorNote error={searchParams.error} />
      <p className="num text-sm text-muted">{prettyDay(today)} · {plan.window === 'morning' ? 'Morning' : 'Evening'}</p>
      <h1 className="mt-1 font-serif text-2xl leading-snug">{ctx.text}</h1>

      {plan.mode === 'after_session' ? (
        <Section title="From your session">
          {lastRecap ? <p className="font-serif text-lg">{lastRecap.text}</p> : <p className="text-muted">Your clinician has not added a note yet.</p>}
          <form action={savePatientRecapNote} className="mt-3 flex gap-2">
            <input className="field" name="text" maxLength={400} placeholder="What are you taking from it? (private)" aria-label="What are you taking from the session" required />
            <button className="btn" type="submit">Save</button>
          </form>
        </Section>
      ) : null}

      {plan.mode === 'before_session' ? (
        <Section title="Before your session" hint="You decide what is shared.">
          <p className="text-sm">
            <Link className="underline" href="/patient/you">See exactly what your clinician can see now</Link>
          </p>
        </Section>
      ) : null}

      <Section title={plan.asks.length ? 'Now' : 'Check-in'} hint={plan.asks.length ? 'A few taps. Skipping is fine.' : undefined}>
        {plan.asks.length === 0 && answeredToday.length === 0 ? <p className="text-muted">Nothing to ask right now.</p> : null}
        <div className="space-y-3">
          {plan.asks.map((a) => {
            const s = data.signals.find((x) => x.id === a.signalId)!;
            return <ScalePrompt key={a.signalId} signal={s} reason={a.reason} />;
          })}
          {answeredToday.map((s) => {
            const series = seriesOf(data.entries, s.id);
            const base = computeBaseline(series, today);
            const todayVal = series.find((p) => p.day === today)?.value;
            return (
              <div key={s.id} className="rounded-xl border border-line bg-card p-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{s.label} <span className="num">{todayVal}{s.unit ? ' ' + s.unit : ''}</span></span>
                  <span className="text-xs text-muted">{base.status === 'ok' ? `your usual ${Math.round(base.median * 10) / 10}` : 'still learning your usual'}</span>
                </div>
                <Sparkline label={s.label} points={lastDays(series, today, 28)} band={base.status === 'ok' ? { lo: base.q1, hi: base.q3 } : null} />
              </div>
            );
          })}
        </div>
        <p className="mt-3">
          <Link className="btn" href="/patient/moment">Something happened</Link>
        </p>
      </Section>

      {focusToday.length > 0 ? (
        <Section title="What you are working on">
          <div className="space-y-3">
            {focusToday.slice(0, 2).map((f) => {
              const done = data.focusChecks.find((c) => c.focusId === f.id && c.day === today);
              return (
                <div key={f.id} className="rounded-xl border border-line bg-card p-4">
                  <div className="font-serif text-lg">{f.title}</div>
                  <div className="text-xs text-muted">{f.createdBy === 'clinician' ? 'Agreed with your clinician' : 'Your own'}</div>
                  {done ? (
                    <p className="mt-2 text-sm">Today: {done.status.replace('_', ' ')}{done.obstacle ? ` (${done.obstacle})` : ''}</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <form action={focusCheck} className="flex flex-wrap gap-2">
                        <input type="hidden" name="focusId" value={f.id} />
                        <button className="btn" name="status" value="done" type="submit">Done</button>
                        <button className="btn" name="status" value="partial" type="submit">Partly</button>
                      </form>
                      <details>
                        <summary className="cursor-pointer text-sm text-muted">Not today</summary>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {OBSTACLES.map((o) => (
                            <form key={o} action={focusNotDone}>
                              <input type="hidden" name="focusId" value={f.id} />
                              <input type="hidden" name="obstacle" value={o} />
                              <button className="btn" type="submit">{o}</button>
                            </form>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}

      <Section title="Since last time">
        {changes.length > 0 ? (
          <StatementList statements={changes.slice(0, 1)} scoped={data} />
        ) : learning && learning.info.status === 'insufficient' ? (
          <p className="text-muted">
            Learning your usual {learning.label.toLowerCase()}: {learning.info.have} of {learning.info.need} days so far{learning.info.readyOn ? `, ready around ${prettyDay(learning.info.readyOn)}` : ''}. That is when changes start to mean something.
          </p>
        ) : (
          <p className="text-muted">Nothing has changed beyond your usual range.</p>
        )}
      </Section>

      <Section title="Open threads" hint="Things you wanted to bring up.">
        <div className="thread space-y-3">
          {openAgenda.slice(0, 3).map((a) => (
            <div key={a.id} className="thread-item">
              <p className="font-serif">{a.text}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="chip">{a.shared ? 'Shared with clinician' : '🔒 Private'}</span>
                <form action={agendaShareAction}><input type="hidden" name="agendaId" value={a.id} /><input type="hidden" name="shared" value={String(!a.shared)} /><button className="btn" type="submit">{a.shared ? 'Make private' : 'Share'}</button></form>
                <form action={agendaStatusAction}><input type="hidden" name="agendaId" value={a.id} /><input type="hidden" name="status" value="done" /><button className="btn" type="submit">Done</button></form>
              </div>
            </div>
          ))}
          {openAgenda.length === 0 ? <p className="text-muted">Nothing yet.</p> : null}
        </div>
        <form action={addAgendaAction} className="mt-4 space-y-2">
          <input className="field" name="text" maxLength={240} placeholder="Something to bring up" aria-label="Something to bring up" required />
          <div className="flex items-center gap-2">
            <label className="chip"><input type="checkbox" name="shared" value="true" /> Share with my clinician</label>
            <button className="btn" type="submit">Add</button>
          </div>
        </form>
      </Section>

      <ShowcaseNote>
        Today is a 30-second ritual, not a form: a context line that changes with what is happening, at most three prompts chosen by plain rules, one source-linked change against the person&apos;s own usual, and the things they want to bring to the next session. No streaks, no points.
      </ShowcaseNote>

      {nothingLeft ? <p className="mt-10 text-center text-sm text-muted">Done for now. See you next time.</p> : null}
    </div>
  );
}
