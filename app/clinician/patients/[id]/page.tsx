import Link from 'next/link';
import { pageClinicianPatient } from '@/lib/session';
import { todayIn, prettyDay } from '@/lib/domain/dates';
import { computeBrief } from '@/lib/domain/insights/brief';
import { scopeFor } from '@/lib/domain/insights/scope';
import { edgeSummaries } from '@/lib/domain/map/summaries';
import { playbook } from '@/lib/domain/playbook/summary';
import { computeBaseline } from '@/lib/domain/insights/baseline';
import { seriesOf, lastDays } from '@/lib/domain/insights/series';
import { StatementList } from '@/components/StatementList';
import { MapDiagram, STATUS_LABEL } from '@/components/MapDiagram';
import { Sparkline } from '@/components/Sparkline';
import { Section } from '@/components/Shell';
import { logAudit, auditFor, getStore } from '@/lib/data/store';
import { saveRecap, proposeEdge, confirmEdgeClinician, polishBrief, createFocusAction, setNextSessionAction, markSessionHappenedAction } from '@/app/actions';
import { ErrorNote } from '@/components/Shell';
import { ShowcaseNote } from '@/components/ShowcaseNote';
import { addDays } from '@/lib/domain/dates';
import { defaultReviewDay } from '@/lib/domain/focus';
import { AI_MESSAGES } from '@/lib/ai/provider';
import type { AiErrorCode } from '@/lib/ai/provider';
import { aiConfigured } from '@/lib/ai/provider';
import { evidenceLines } from '@/lib/domain/insights/evidence';

const TABS = [
  ['brief', 'Brief'],
  ['map', 'Map'],
  ['history', 'History'],
  ['journal', 'Shared journal'],
  ['plan', 'Sessions & plan'],
  ['access', 'Access log'],
] as const;

export default function PatientPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string; aiError?: string; error?: string } }) {
  const { actor, data } = pageClinicianPatient(params.id);
  const tab = TABS.some(([k]) => k === searchParams.tab) ? (searchParams.tab as string) : 'brief';
  const today = todayIn(data.timezone);
  const viewer = { role: 'clinician' as const, clinicianId: actor.id, patientId: data.patientId };
  const scoped = scopeFor(data, viewer); // EVERYTHING below is computed from, and rendered from, scoped data
  if (tab === 'brief') logAudit(actor.id, 'clinician', 'brief.view', data.patientId); // content-free

  const brief = computeBrief(data, viewer, today);
  const pol = getStore().polished.get(`clinician:${data.patientId}`);
  const polished = pol ? new Map(pol.statements.map((s) => [s.id, s.text])) : undefined;
  const sections: Array<[string, string]> = [
    ['changed', 'What changed'],
    ['stable', 'What stayed stable'],
    ['focus', 'Focus items and patterns being tested'],
    ['map', 'Map: links seen in shared Moments'],
    ['measures', 'Questionnaires the patient shared'],
    ['topics', 'Possible topics'],
    ['bring', 'What the patient wants to bring'],
  ];
  const notShared: string[] = [];
  if (!data.consents.share_checkins) notShared.push('Check-ins');
  if (!data.consents.share_map) notShared.push('Map');
  if (!data.consents.share_focus) notShared.push('Focus check-ins');
  if (!data.consents.share_assessments) notShared.push('Questionnaires');
  const aiErr = searchParams.aiError as AiErrorCode | undefined;
  const sums = edgeSummaries(scoped, today);
  const recaps = getStore().recaps.get(data.patientId) ?? [];

  return (
    <div>
      <p className="text-sm"><Link className="underline text-muted" href="/clinician">All patients</Link></p>
      <h1 className="mt-1 font-serif text-3xl">{data.displayName}</h1>
      <nav className="mt-3 flex gap-1 overflow-x-auto" aria-label="Patient sections">
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/clinician/patients/${data.patientId}?tab=${k}`} aria-current={tab === k ? 'page' : undefined} className={`rounded-lg px-3 py-2 text-sm min-h-[44px] flex items-center whitespace-nowrap ${tab === k ? 'bg-accent-soft font-semibold' : 'text-muted hover:text-ink'}`}>{l}</Link>
        ))}
      </nav>

      {tab === 'brief' ? (
        <div>
          <p className="mt-4 text-sm text-muted num">
            Coverage: {brief.coverage.have} of {brief.coverage.expected} expected daily check-ins in the last {brief.coverage.days} days. Generated now from consented, patient-reported data. Not saved to any record. Not a diagnosis.
          </p>
          {notShared.length > 0 ? <p className="mt-1 text-sm text-muted">Not shared by the patient: {notShared.join(', ')}.</p> : null}
          {sections.map(([key, title]) => {
            const list = brief.statements.filter((s) => s.section === key);
            if (list.length === 0) return null;
            return (
              <Section key={key} title={title}>
                <StatementList statements={list} scoped={scoped} polished={polished} />
              </Section>
            );
          })}
          {brief.statements.length === 0 ? <p className="mt-6 rounded-xl border border-line bg-card p-4">The patient has not shared any data yet. Their consent settings are theirs to change.</p> : null}
          {brief.notes.length > 0 ? (
            <Section title="Not enough data yet">
              <ul className="text-sm text-muted">
                {brief.notes.map((n, i) => <li key={i}>{n.label}: {n.info.have} of {n.info.need}{n.info.unit ? ` ${n.info.unit}` : ''}, needed for {n.info.unlocks}.</li>)}
              </ul>
            </Section>
          ) : null}
          <ShowcaseNote>
            Everything above was computed from what this patient chose to share, against their own usual, with no real-time monitoring. Every line has its evidence under “View entries”. Ask the patient to switch a sharing setting off and refresh this page.
          </ShowcaseNote>
          <form action={polishBrief} className="mt-8 flex items-center gap-3">
            <input type="hidden" name="patientId" value={data.patientId} />
            <button className="btn" type="submit" disabled={!aiConfigured() || !data.consents.allow_ai_analysis}>Smooth the wording with AI</button>
            <span className="text-xs text-muted">{!data.consents.allow_ai_analysis ? 'The patient has not allowed AI wording.' : !aiConfigured() ? 'AI is not set up.' : 'Wording only. Numbers and sources are checked.'}</span>
          </form>
          {aiErr && AI_MESSAGES[aiErr] ? <p role="alert" className="mt-2 text-sm text-amber">{AI_MESSAGES[aiErr]}</p> : null}
        </div>
      ) : null}

      {tab === 'map' ? (
        <div>
          {scoped.nodes.length === 0 ? <p className="mt-6 rounded-xl border border-line bg-card p-4">Nothing on the Map is shared with you yet.</p> : <div className="mt-6"><MapDiagram nodes={scoped.nodes} summaries={sums} /></div>}
          <Section title="Links" hint="Statuses show where each link comes from. Observed never means causal.">
            <ul className="space-y-3">
              {sums.map((s) => (
                <li key={s.edge.id} className="rounded-xl border border-line bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{s.fromLabel} → {s.toLabel}</span><span className="chip">{STATUS_LABEL[s.shown]}</span></div>
                  <p className="mt-1 text-sm">{s.text}</p>
                  {s.sourceRefs.length > 0 ? <details className="mt-1 text-sm"><summary className="cursor-pointer text-muted">View entries</summary><ul className="text-muted num">{evidenceLines(scoped, s.sourceRefs).map((l, i) => <li key={i}>{l}</li>)}</ul></details> : null}
                  {(s.edge.status === 'patient_belief' || s.edge.status === 'proposed') ? (
                    <form action={confirmEdgeClinician} className="mt-2">
                      <input type="hidden" name="patientId" value={data.patientId} /><input type="hidden" name="edgeId" value={s.edge.id} />
                      <button className="btn" type="submit">I agree this fits</button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Propose a connection" hint="Starts as a clinician hypothesis. The patient is asked whether it sounds like them.">
            <form action={proposeEdge} className="grid gap-2 sm:grid-cols-4">
              <input type="hidden" name="patientId" value={data.patientId} />
              <select name="from" className="field" aria-label="From">{scoped.nodes.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</select>
              <select name="relation" className="field" aria-label="Relation">
                <option value="appears_with">appears with</option><option value="tends_to_follow">tends to follow</option><option value="may_maintain">may maintain</option><option value="may_reduce">may reduce</option><option value="blocks">may block</option>
              </select>
              <select name="to" className="field" aria-label="To">{scoped.nodes.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</select>
              <button className="btn btn-primary" type="submit">Add as hypothesis</button>
            </form>
          </Section>
          {(() => {
            const pb = playbook(data, viewer, today);
            return pb.early && pb.early.lines.length > 0 ? (
              <Section title="Early signs the patient shared">
                <ul className="space-y-3">{pb.early.lines.map((l, i) => <li key={i} className="st-OBSERVED py-1"><span className="chip">{l.label}</span><p>{l.text}</p></li>)}</ul>
              </Section>
            ) : null;
          })()}
        </div>
      ) : null}

      {tab === 'history' ? (
        <div className="mt-6 space-y-4">
          {scoped.signals.length === 0 ? <p className="rounded-xl border border-line bg-card p-4">No signals are shared with you.</p> : null}
          {scoped.signals.map((s) => {
            const series = seriesOf(scoped.entries, s.id);
            const base = computeBaseline(series, today);
            return (
              <div key={s.id} className="rounded-xl border border-line bg-card p-4">
                <div className="flex items-baseline justify-between"><span className="font-medium">{s.label}</span><span className="text-xs text-muted">{base.status === 'ok' ? `patient's usual ${Math.round(base.median * 10) / 10}${s.unit ? ' ' + s.unit : ''}` : 'baseline not yet available'}</span></div>
                <Sparkline label={s.label} points={lastDays(series, today, 28)} band={base.status === 'ok' ? { lo: base.q1, hi: base.q3 } : null} />
              </div>
            );
          })}
        </div>
      ) : null}

      {tab === 'journal' ? (
        <ul className="mt-6 space-y-3">
          {scoped.journal.map((j) => <li key={j.id} className="rounded-xl border border-line bg-card p-3"><div className="num text-sm text-muted">{prettyDay(j.day)} · shared by the patient</div><p className="font-serif whitespace-pre-wrap">{j.text}</p></li>)}
          {scoped.journal.length === 0 ? <li className="rounded-xl border border-line bg-card p-4">No journal entries are shared with you.</li> : null}
        </ul>
      ) : null}

      {tab === 'plan' ? (
        <div>
          <ErrorNote error={searchParams.error} />
          <Section title="Next session" hint="The patient's Today switches to a preparation view two days before, and a follow-up view after.">
            <form action={setNextSessionAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="patientId" value={data.patientId} />
              <div><label className="label" htmlFor="nd">Date</label><input id="nd" className="field num" type="date" name="day" min={today} max={addDays(today, 365)} required /></div>
              <button className="btn btn-primary" type="submit">Set</button>
            </form>
            <ul className="mt-3 space-y-1 text-sm">
              {[...data.sessions].sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, 6).map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="num">{prettyDay(s.day)}</span>
                  <span className="chip">{s.occurred ? 'happened' : s.day < today ? 'past, not marked' : 'upcoming'}</span>
                  {!s.occurred && s.day <= today ? (
                    <form action={markSessionHappenedAction}><input type="hidden" name="patientId" value={data.patientId} /><input type="hidden" name="sessionId" value={s.id} /><button className="btn" type="submit">Mark as happened</button></form>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Add a focus" hint="Something you and the patient agree to watch or try. It appears on the patient's Today and Map.">
            <form action={createFocusAction} className="grid gap-3 rounded-xl border border-line bg-card p-4 sm:grid-cols-2">
              <input type="hidden" name="patientId" value={data.patientId} />
              <div className="sm:col-span-2">
                <label className="label" htmlFor="ft">In one sentence</label>
                <input id="ft" className="field" name="title" maxLength={160} required placeholder="e.g. When I sleep less, my anxiety is higher" />
              </div>
              <div>
                <label className="label" htmlFor="fk">Kind</label>
                <select id="fk" className="field" name="kind" defaultValue="commitment">
                  <option value="hypothesis">Hypothesis to test (declare the pair below)</option>
                  <option value="experiment">Experiment (tracks one signal)</option>
                  <option value="commitment">Commitment</option>
                  <option value="goal">Goal</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="fs">Starts</label>
                <input id="fs" className="field num" type="date" name="startDay" defaultValue={today} />
              </div>
              <div>
                <label className="label" htmlFor="fr">Review on (optional)</label>
                <input id="fr" className="field num" type="date" name="reviewDay" defaultValue={defaultReviewDay(today)} />
              </div>
              <fieldset className="sm:col-span-2">
                <legend className="label">Linked signals (only ones the patient shares with you)</legend>
                {scoped.signals.length === 0 ? <p className="text-sm text-muted">The patient shares no signals with you yet, so hypotheses and experiments are not available.</p> : (
                  <div className="flex flex-wrap gap-2">{scoped.signals.map((s) => <label key={s.id} className="chip"><input type="checkbox" name="signalIds" value={s.id} /> {s.label}</label>)}</div>
                )}
              </fieldset>
              {scoped.signals.length >= 2 ? (
                <fieldset className="sm:col-span-2 rounded-lg border border-line p-3">
                  <legend className="label">For a hypothesis: declare the pair BEFORE looking at the data</legend>
                  <div className="grid gap-2 sm:grid-cols-5">
                    <select className="field" name="pairA" aria-label="First signal">{scoped.signals.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
                    <select className="field" name="aState" aria-label="First signal state" defaultValue="low"><option value="low">is low</option><option value="high">is high</option></select>
                    <select className="field" name="pairB" aria-label="Second signal" defaultValue={scoped.signals[1].id}>{scoped.signals.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
                    <select className="field" name="bState" aria-label="Second signal state" defaultValue="high"><option value="low">is low</option><option value="high">is high</option></select>
                    <select className="field" name="lag" aria-label="When" defaultValue="0"><option value="0">same day</option><option value="1">next day</option></select>
                  </div>
                  <p className="mt-1 text-xs text-muted">Declaring the pair first keeps this a test of your idea, not a search through every combination.</p>
                </fieldset>
              ) : null}
              <div><button className="btn btn-primary" type="submit">Add focus</button></div>
            </form>
            <ul className="mt-3 space-y-1 text-sm">
              {scoped.focusItems.map((f) => <li key={f.id}><span className="chip">{f.kind}</span> <span className="font-serif">{f.title}</span></li>)}
            </ul>
          </Section>

          <Section title="After the session" hint="A one-minute recap. The patient sees it on their Today screen. Nothing is sent to anyone else.">
            <form action={saveRecap} className="space-y-2">
              <input type="hidden" name="patientId" value={data.patientId} />
              <label className="label" htmlFor="t">Take-home note for the patient (plain language)</label>
              <textarea id="t" name="text" className="field" rows={3} maxLength={600} required />
              <label className="label" htmlFor="c">Optional: one thing to try before next time</label>
              <input id="c" name="commitment" className="field" maxLength={120} placeholder="e.g. Notice one calm moment each day" />
              <button className="btn btn-primary" type="submit">Save recap</button>
            </form>
            <p className="mt-2 text-xs text-muted">AI-drafted recaps are part of the roadmap, not this demo.</p>
          </Section>
          <Section title="Earlier recaps">
            <ul className="space-y-2">{recaps.map((r, i) => <li key={i} className="text-sm"><span className="num text-muted">{prettyDay(r.day)}</span> · {r.text}</li>)}{recaps.length === 0 ? <li className="text-muted">None yet.</li> : null}</ul>
          </Section>
        </div>
      ) : null}

      {tab === 'access' ? (
        <Section title="Your access to this record" hint="Content-free: what you opened and when.">
          <ul className="space-y-1 text-sm text-muted num">
            {auditFor(data.patientId).filter((a) => a.actorId === actor.id).map((a) => <li key={a.id}>{new Date(a.at).toLocaleString('en-GB')} · {a.action}</li>)}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
