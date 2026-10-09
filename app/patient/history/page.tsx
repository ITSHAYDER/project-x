import { pagePatient } from '@/lib/session';
import { todayIn, prettyDay, addDays } from '@/lib/domain/dates';
import { computeBrief } from '@/lib/domain/insights/brief';
import { computeBaseline } from '@/lib/domain/insights/baseline';
import { seriesOf, lastDays } from '@/lib/domain/insights/series';
import { Sparkline } from '@/components/Sparkline';
import { StatementList } from '@/components/StatementList';
import { Section } from '@/components/Shell';
import { AI_MESSAGES } from '@/lib/ai/provider';
import type { AiErrorCode } from '@/lib/ai/provider';
import { aiConfigured } from '@/lib/ai/provider';
import { polishBrief } from '@/app/actions';
import { getStore } from '@/lib/data/store';

export default function History({ searchParams }: { searchParams: { aiError?: string } }) {
  const { actor, data } = pagePatient();
  const today = todayIn(data.timezone);
  const brief = computeBrief(data, { role: 'patient', patientId: actor.id }, today);
  const pol = getStore().polished.get(`patient:${actor.id}`);
  const polished = pol ? new Map(pol.statements.map((s) => [s.id, s.text])) : undefined;
  const aiErr = searchParams.aiError as AiErrorCode | undefined;
  return (
    <div>
      <h1 className="font-serif text-2xl">History</h1>
      <p className="mt-1 text-muted">Your own record, against your own usual. Nothing here compares you to anyone else.</p>

      <Section title="What changed">
        {brief.statements.filter((s) => s.section === 'changed' || s.section === 'stable').length === 0 ? (
          <p className="text-muted">Changes show up here once your usual is clear.</p>
        ) : (
          <StatementList statements={brief.statements.filter((s) => s.section === 'changed' || s.section === 'stable')} scoped={data} polished={polished} />
        )}
        <form action={polishBrief} className="mt-4 flex items-center gap-3">
          <input type="hidden" name="patientId" value={actor.id} />
          <button className="btn" type="submit" disabled={!aiConfigured()}>Smooth the wording with AI</button>
          <span className="text-xs text-muted">{aiConfigured() ? 'Wording only. Every number and source is checked.' : 'AI is not set up. Everything works without it.'}</span>
        </form>
        {aiErr && AI_MESSAGES[aiErr] ? <p role="alert" className="mt-2 text-sm text-amber">{AI_MESSAGES[aiErr]}</p> : null}
      </Section>

      <Section title="Patterns you and your clinician are testing">
        <StatementList statements={brief.statements.filter((s) => s.section === 'focus')} scoped={data} polished={polished} />
        {brief.statements.filter((s) => s.section === 'focus').length === 0 ? <p className="text-muted">Nothing is being tested yet.</p> : null}
      </Section>

      <Section title="Your signals" hint="The shaded band is your own usual range.">
        <div className="space-y-4">
          {data.signals.map((s) => {
            const series = seriesOf(data.entries, s.id);
            const base = computeBaseline(series, today);
            const pts = lastDays(series, today, 28);
            return (
              <div key={s.id} className="rounded-xl border border-line bg-card p-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{s.label}</span>
                  <span className="text-xs text-muted">{base.status === 'ok' ? `usual ${Math.round(base.median * 10) / 10}${s.unit ? ' ' + s.unit : ''}` : 'still learning your usual'}</span>
                </div>
                <Sparkline label={s.label} points={pts} band={base.status === 'ok' ? { lo: base.q1, hi: base.q3 } : null} />
                <details className="mt-1 text-sm">
                  <summary className="cursor-pointer text-muted">Show as a table</summary>
                  <table className="mt-2 w-full text-left text-sm num">
                    <tbody>
                      {series.slice(-14).reverse().map((p) => (
                        <tr key={p.day}><td className="pr-4 text-muted">{prettyDay(p.day)}</td><td>{p.value}{s.unit ? ' ' + s.unit : ''}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">Window shown: {prettyDay(addDays(today, -27))} to {prettyDay(today)}.</p>
      </Section>
    </div>
  );
}
