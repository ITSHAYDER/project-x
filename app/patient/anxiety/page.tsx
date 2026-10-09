import Link from 'next/link';
import { pagePatient } from '@/lib/session';
import { todayIn, prettyDay } from '@/lib/domain/dates';
import { computeBrief } from '@/lib/domain/insights/brief';
import { computeBaseline } from '@/lib/domain/insights/baseline';
import { seriesOf, lastDays } from '@/lib/domain/insights/series';
import { anxietyContext } from '@/lib/domain/playbook/anxietyContext';
import { toolEvidence } from '@/lib/domain/playbook/whatHelps';
import { gad7Change } from '@/lib/domain/gad7';
import { fmt } from '@/lib/domain/stats';
import { Sparkline } from '@/components/Sparkline';
import { ScalePrompt } from '@/components/ScalePrompt';
import { StatementList } from '@/components/StatementList';
import { ErrorNote, Section } from '@/components/Shell';
import { ShowcaseNote } from '@/components/ShowcaseNote';
import { startAnxietyTrackingAction } from '@/app/actions';

export default function Anxiety({ searchParams }: { searchParams: { error?: string } }) {
  const { actor, data } = pagePatient();
  const today = todayIn(data.timezone);
  const sig = data.signals.find((s) => s.id === 'anxiety');
  const g7 = gad7Change(data.assessments);
  const history = [...data.assessments].filter((a) => a.kind === 'gad7').sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, 6);

  const header = (
    <>
      <ErrorNote error={searchParams.error} />
      <h1 className="font-serif text-2xl">Anxiety</h1>
      <p className="mt-1 text-muted">How it has been for you, against your own usual. This shows patterns in what you report. It does not diagnose, predict or explain causes.</p>
    </>
  );

  if (!sig) {
    return (
      <div>
        {header}
        <Section title="Start tracking">
          <form action={startAnxietyTrackingAction} className="rounded-xl border border-line bg-card p-4">
            <p>A 0 to 10 rating each evening, about how anxious the day felt. After about two weeks, changes start to mean something.</p>
            <p className="mt-1 text-sm text-muted">Private until you choose to share it.</p>
            <button className="btn btn-primary mt-3" type="submit">Start tracking anxiety</button>
          </form>
        </Section>
        <Gad7Card g7={g7} history={history} />
      </div>
    );
  }

  const series = seriesOf(data.entries, sig.id);
  const base = computeBaseline(series, today);
  const answeredToday = series.some((p) => p.day === today);
  const brief = computeBrief(data, { role: 'patient', patientId: actor.id }, today);
  const mine = brief.statements.filter((s) => s.id.endsWith(':anxiety'));
  const ctx = anxietyContext(data, today, sig.id);
  const tools = data.tools.filter((t) => t.outcomeSignalId === sig.id).map((t) => ({ t, ev: toolEvidence(data.toolUses.filter((u) => u.toolId === t.id), series, sig) }));
  const note = brief.notes.find((n) => n.label === sig.label);

  return (
    <div>
      {header}
      {!sig.active ? <p className="mt-4 rounded-xl border border-line bg-card p-3 text-sm">Anxiety tracking is paused. You can resume it under <Link className="underline" href="/patient/you">You</Link>.</p> : null}

      <Section title="Today">
        {answeredToday ? (
          <p className="text-muted">Logged for today: <span className="num font-medium text-ink">{series.find((p) => p.day === today)?.value}</span> out of 10.</p>
        ) : sig.active ? (
          <ScalePrompt signal={sig} reason="your anxiety check-in" back="/patient/anxiety" />
        ) : null}
        <div className="mt-3 rounded-xl border border-line bg-card p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-medium">Last 4 weeks</span>
            <span className="text-xs text-muted">{base.status === 'ok' ? `your usual ${fmt(base.median)} (shaded)` : 'still learning your usual'}</span>
          </div>
          <Sparkline label="Anxiety" points={lastDays(series, today, 28)} band={base.status === 'ok' ? { lo: base.q1, hi: base.q3 } : null} />
          {base.status !== 'ok' ? (
            <p className="mt-1 text-sm text-muted">{base.have} of {base.need} days so far{base.readyOn ? `, ready around ${prettyDay(base.readyOn)}` : ''}. That is when changes start to mean something.</p>
          ) : null}
        </div>
      </Section>

      <Section title="What changed">
        {mine.length > 0 ? <StatementList statements={mine} scoped={data} /> : note ? <p className="text-muted">Not enough days yet to compare against your usual.</p> : <p className="text-muted">Nothing has moved outside your usual range.</p>}
      </Section>

      <Section title="On your higher-anxiety days" hint="Situations you logged on your own top-quarter anxiety days, compared with your other days. Counts only: this does not say what causes what.">
        {ctx.status === 'ok' ? (
          ctx.situations.length > 0 ? (
            <ul className="space-y-2">
              {ctx.situations.map((s) => (
                <li key={s.label} className="st-OBSERVED py-1">
                  <b>{s.label}</b>: logged on {s.onHigher} of {s.higherDays} higher days, and on {s.onOther} of {s.otherDays} other days.
                </li>
              ))}
            </ul>
          ) : <p className="text-muted">No situation shows up more than once on your higher days yet.</p>
        ) : (
          <p className="text-muted">Needs {ctx.need} {ctx.unit ?? 'days'} ({ctx.have} so far), plus Moments that name the situation. Keep logging and this fills in.</p>
        )}
      </Section>

      <Section title="What tends to go with calmer days" hint="Things you tried, compared with days you did not. A pattern in your entries, not a cause.">
        <ul className="space-y-2">
          {tools.map(({ t, ev }) => (
            <li key={t.id} className="rounded-xl border border-line bg-card p-3">
              <div className="font-medium">{t.label}</div>
              <p className="text-sm">
                {ev.status === 'ok'
                  ? `On ${ev.betterWith} of ${ev.uses} days you used it, anxiety was lower than your usual; on other days: ${ev.betterWithout} of ${ev.without}.`
                  : `Not enough uses yet (${ev.have} of ${ev.need}) to compare days with and without it.`}
              </p>
            </li>
          ))}
          {tools.length === 0 ? <li className="text-muted">When you log a Moment, tick what you tried. This shows what tends to go along with calmer days.</li> : null}
        </ul>
        <p className="mt-3"><Link className="btn" href="/patient/moment">Something happened</Link></p>
      </Section>

      <Gad7Card g7={g7} history={history} />
      <ShowcaseNote>
        The anxiety view stays descriptive on purpose: your own rating against your own usual, situations by count, and what you tried. The GAD-7 shows a total and the change, never a severity label or a diagnosis.
      </ShowcaseNote>
    </div>
  );
}

function Gad7Card({ g7, history }: { g7: ReturnType<typeof gad7Change>; history: Array<{ id: string; day: string; total: number }> }) {
  return (
    <Section title="GAD-7 questionnaire" hint="Seven questions, about two minutes. A screening questionnaire many clinicians use as a conversation starter. It is not a diagnosis.">
      {g7 ? (
        <p className="num">
          Latest: <b>{g7.latest.total}</b> on {prettyDay(g7.latest.day)}
          {g7.previous && g7.diff !== null ? ` · before that ${g7.previous.total} (${g7.diff === 0 ? 'no change' : g7.diff > 0 ? `${g7.diff} higher` : `${Math.abs(g7.diff)} lower`})` : ''}
        </p>
      ) : (
        <p className="text-muted">You have not taken it yet.</p>
      )}
      {history.length > 1 ? <ul className="mt-2 space-y-1 text-sm text-muted num">{history.map((h) => <li key={h.id}>{prettyDay(h.day)}: {h.total}</li>)}</ul> : null}
      <p className="mt-3"><Link className="btn btn-primary" href="/patient/anxiety/gad7">Take the GAD-7</Link></p>
      <p className="mt-2 text-xs text-muted">Your clinician sees it only if you switch on “Share my questionnaire results” under You. If you are struggling right now, <Link className="underline" href="/patient/support">find support</Link>.</p>
    </Section>
  );
}
