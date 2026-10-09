import { pagePatient } from '@/lib/session';
import { todayIn } from '@/lib/domain/dates';
import { edgeSummaries } from '@/lib/domain/map/summaries';
import { playbook } from '@/lib/domain/playbook/summary';
import { MapDiagram, STATUS_LABEL } from '@/components/MapDiagram';
import { Section } from '@/components/Shell';
import { patientEdgeResponse, addNodeAction, addEdgeAction } from '@/app/actions';
import { ErrorNote } from '@/components/Shell';
import { ShowcaseNote } from '@/components/ShowcaseNote';
import { evidenceLines } from '@/lib/domain/insights/evidence';

export default function MyMap({ searchParams }: { searchParams: { error?: string } }) {
  const { actor, data } = pagePatient();
  const today = todayIn(data.timezone);
  const sums = edgeSummaries(data, today).filter((s) => s.shown !== 'dismissed');
  const pb = playbook(data, { role: 'patient', patientId: actor.id }, today);
  const used = new Set(sums.flatMap((s) => [s.edge.from, s.edge.to]));
  const nodes = data.nodes.filter((n) => used.has(n.id));
  const active = data.focusItems.filter((f) => f.status === 'active');
  return (
    <div>
      <ErrorNote error={searchParams.error} />
      <h1 className="font-serif text-2xl">My Map</h1>
      <p className="mt-1 text-muted">How the things you record seem to connect. Some links come from your clinician, some from you, some from your own entries. Each says which.</p>

      {nodes.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-card p-4">Your Map starts with your first Moment, or with links you and your clinician draft together.</p>
      ) : (
        <div className="mt-6"><MapDiagram nodes={nodes} summaries={sums} /></div>
      )}

      <Section title="The links" hint="Tell us whether each one sounds like you.">
        <ul className="space-y-4">
          {sums.map((s) => (
            <li key={s.edge.id} className="rounded-xl border border-line bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{s.fromLabel} → {s.toLabel}</span>
                <span className="chip">{STATUS_LABEL[s.shown]}</span>
              </div>
              <p className="mt-1 text-sm">{s.text}</p>
              {s.sourceRefs.length > 0 ? (
                <details className="mt-1 text-sm">
                  <summary className="cursor-pointer text-muted">View entries</summary>
                  <ul className="mt-1 text-muted num">{evidenceLines(data, s.sourceRefs).map((l, i) => <li key={i}>{l}</li>)}</ul>
                </details>
              ) : null}
              <form action={patientEdgeResponse} className="mt-2 flex flex-wrap gap-2">
                <input type="hidden" name="edgeId" value={s.edge.id} />
                <button className="btn" name="answer" value="yes" type="submit">Yes, that is me</button>
                <button className="btn" name="answer" value="unsure" type="submit">Not sure</button>
                <button className="btn" name="answer" value="no" type="submit">Not really</button>
              </form>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Add to your Map" hint="Anything you add starts as your own belief. It only shows as seen in your entries once your entries support it.">
        <div className="grid gap-4 sm:grid-cols-2">
          <form action={addNodeAction} className="space-y-2 rounded-xl border border-line bg-card p-4">
            <h3 className="font-medium">A new thing</h3>
            <input className="field" name="label" maxLength={60} placeholder="e.g. Money worries" aria-label="Name" required />
            <select className="field" name="kind" aria-label="Kind" defaultValue="situation">
              <option value="situation">Situation</option><option value="thought">Thought</option><option value="emotion">Feeling</option><option value="body">Body</option><option value="behavior">What I do</option><option value="context">Context</option><option value="strength">Strength</option>
            </select>
            <button className="btn" type="submit">Add</button>
          </form>
          <form action={addEdgeAction} className="space-y-2 rounded-xl border border-line bg-card p-4">
            <h3 className="font-medium">A link between two things</h3>
            <select className="field" name="from" aria-label="From" required>{data.nodes.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</select>
            <select className="field" name="relation" aria-label="How they connect" defaultValue="tends_to_follow">
              <option value="appears_with">appears with</option><option value="tends_to_follow">tends to follow</option><option value="may_maintain">may keep going</option><option value="may_reduce">may ease</option><option value="blocks">may get in the way of</option>
            </select>
            <select className="field" name="to" aria-label="To" required>{data.nodes.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</select>
            <button className="btn" type="submit">Add link</button>
          </form>
        </div>
      </Section>

      <Section title="Playbook" hint="What you keep: your early signs and what helps you, from your own entries.">
        <h3 className="font-medium">Early signs</h3>
        {pb.early && pb.early.result.status === 'ok' && pb.early.lines.length > 0 ? (
          <ul className="mt-2 space-y-3">
            {pb.early.lines.map((l, i) => (
              <li key={i} className="st-OBSERVED py-1">
                <span className="chip">{l.label}</span>
                <p>{l.text}</p>
              </li>
            ))}
          </ul>
        ) : pb.early && pb.early.result.status === 'insufficient' ? (
          <p className="mt-1 text-muted">Looking back at what moved before harder periods needs {pb.early.result.need} {pb.early.result.unit ?? ''} ({pb.early.result.have} so far). Keep logging and this fills in.</p>
        ) : (
          <p className="mt-1 text-muted">No consistent early signs found yet.</p>
        )}
        <h3 className="mt-6 font-medium">What helps</h3>
        <ul className="mt-2 space-y-3">
          {pb.helps.map((h) => (
            <li key={h.toolId} className="rounded-xl border border-line bg-card p-4">
              <div className="font-medium">{h.label}</div>
              <p className="text-sm">{h.text}</p>
            </li>
          ))}
          {pb.helps.length === 0 ? <li className="text-muted">Add things you try when you log a Moment, and this shows what tends to go along with better days.</li> : null}
        </ul>
        <h3 className="mt-6 font-medium">What you are working on</h3>
        <ul className="mt-2 space-y-2">
          {active.map((f) => (
            <li key={f.id} className="flex items-center gap-2"><span className="chip">{f.kind}</span><span className="font-serif">{f.title}</span></li>
          ))}
          {active.length === 0 ? <li className="text-muted">Nothing yet.</li> : null}
        </ul>
        <p className="mt-6 text-sm text-muted">This is yours. If you stop seeing a clinician, you keep it and can keep adding to it.</p>
      </Section>
      <ShowcaseNote>
        Every link says where it comes from: seen in entries (solid), a clinician&apos;s hypothesis or the patient&apos;s own belief (long dashes, no data yet). “Observed” is computed from the entries, never typed in, and never claims a cause.
      </ShowcaseNote>
    </div>
  );
}
