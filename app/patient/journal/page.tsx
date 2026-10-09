import Link from 'next/link';
import { pagePatient } from '@/lib/session';
import { prettyDay } from '@/lib/domain/dates';
import { addJournalAction, toggleMomentVisibility } from '@/app/actions';
import { ErrorNote, Section } from '@/components/Shell';

export default function Journal({ searchParams }: { searchParams: { error?: string } }) {
  const { data } = pagePatient();
  const label = (id: string) => data.nodes.find((n) => n.id === id)?.label ?? id;
  const moments = [...data.moments].sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, 15);
  const entries = [...data.journal].sort((a, b) => (a.day < b.day ? 1 : -1));
  return (
    <div>
      <ErrorNote error={searchParams.error} />
      <h1 className="font-serif text-2xl">Journal</h1>
      <p className="mt-1 text-muted">Private unless you choose otherwise. A lock means only you can read it.</p>
      <form action={addJournalAction} className="mt-5 space-y-2">
        <label className="label" htmlFor="jt">Write</label>
        <textarea id="jt" name="text" className="field" rows={4} maxLength={4000} required />
        <div className="flex items-center gap-3">
          <select name="visibility" className="field" style={{ width: 'auto' }} aria-label="Who can read this">
            <option value="private">Only me</option>
            <option value="shared">Me and my clinician</option>
          </select>
          <button className="btn btn-primary" type="submit">Save</button>
          <Link className="btn" href="/patient/moment">Something happened</Link>
        </div>
      </form>

      <Section title="Moments">
        <ul className="space-y-3">
          {moments.map((m) => (
            <li key={m.id} className="rounded-xl border border-line bg-card p-3">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="num text-muted">{prettyDay(m.day)}</span>
                <form action={toggleMomentVisibility} className="flex items-center gap-2">
                  <input type="hidden" name="momentId" value={m.id} />
                  <input type="hidden" name="visibility" value={m.visibility === 'private' ? 'shared' : 'private'} />
                  <span className="chip">{m.visibility === 'private' ? '🔒 Only me' : 'Shared'}</span>
                  <button className="btn" type="submit" style={{ minHeight: 44 }}>{m.visibility === 'private' ? 'Share' : 'Make private'}</button>
                </form>
              </div>
              <p className="mt-1">{m.chain.map(label).join(' → ')}</p>
            </li>
          ))}
          {moments.length === 0 ? <li className="text-muted">No Moments yet. When something shifts, capture it in 20 seconds.</li> : null}
        </ul>
      </Section>

      <Section title="Entries">
        <ul className="space-y-3">
          {entries.map((j) => (
            <li key={j.id} className="rounded-xl border border-line bg-card p-3">
              <div className="flex items-center justify-between text-sm"><span className="num text-muted">{prettyDay(j.day)}</span><span className="chip">{j.visibility === 'private' ? '🔒 Only me' : 'Shared'}</span></div>
              <p className="mt-1 font-serif whitespace-pre-wrap">{j.text}</p>
            </li>
          ))}
          {entries.length === 0 ? <li className="text-muted">Nothing written yet.</li> : null}
        </ul>
      </Section>
    </div>
  );
}
