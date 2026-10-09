import Link from 'next/link';
import { pageActor } from '@/lib/session';
import { createInviteAction } from '@/app/actions';
import { ErrorNote } from '@/components/Shell';
import { isShowcase } from '@/lib/config';
import { listClinicianPatients } from '@/lib/data/store';
import { computeBrief } from '@/lib/domain/insights/brief';
import { scopeFor } from '@/lib/domain/insights/scope';
import { todayIn, prettyDay, diffDays } from '@/lib/domain/dates';

export default function ClinicianToday({ searchParams }: { searchParams: { error?: string } }) {
  const a = pageActor('clinician');
  const patients = listClinicianPatients(a.id);
  const rows = patients.map((p) => {
    const today = todayIn(p.timezone);
    const viewer = { role: 'clinician' as const, clinicianId: a.id, patientId: p.patientId };
    const brief = computeBrief(p, viewer, today);
    const scoped = scopeFor(p, viewer);
    const next = p.sessions.filter((s) => !s.occurred && s.day >= today).sort((x, y) => (x.day < y.day ? -1 : 1))[0];
    const last = p.sessions.filter((s) => s.occurred).sort((x, y) => (x.day < y.day ? 1 : -1))[0];
    const flag = brief.statements.find((s) => s.key === 'shift');
    return { p, next, last, today, bring: scoped.agenda.filter((x) => x.status === 'open').length, flag };
  });
  rows.sort((x, y) => ((x.next?.day ?? '9999') < (y.next?.day ?? '9999') ? -1 : 1));
  return (
    <div>
      <ErrorNote error={searchParams.error} />
      <h1 className="font-serif text-2xl">Today</h1>
      <p className="mt-1 text-muted">Patient data is not monitored in real time. You see what each patient has chosen to share, when you open it.</p>
      <ul className="mt-6 space-y-3">
        {rows.map(({ p, next, last, today, bring, flag }) => (
          <li key={p.patientId}>
            <Link href={`/clinician/patients/${p.patientId}`} className="block rounded-xl border border-line bg-card p-4 hover:border-accent">
              <div className="flex items-center justify-between">
                <span className="font-serif text-lg">{p.displayName}</span>
                <span className="num text-sm text-muted">{next ? `Next: ${diffDays(today, next.day) === 0 ? 'today' : prettyDay(next.day)}` : 'No session booked'}</span>
              </div>
              <div className="mt-1 text-sm text-muted">
                {last ? `Last session ${prettyDay(last.day)}` : 'No sessions yet'} · {bring} {bring === 1 ? 'thing' : 'things'} to bring
              </div>
              {flag ? <div className="mt-2 rounded-md bg-amber-soft px-2 py-1 text-sm text-amber">Worth a look: {flag.text}</div> : null}
            </Link>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? <p className="mt-6 text-muted">No patients are linked yet. Invite one to start.</p> : null}
      {!isShowcase() ? (
        <form action={createInviteAction} className="mt-8">
          <button className="btn btn-primary" type="submit">Invite a patient</button>
          <p className="mt-1 text-xs text-muted">Creates a single-use code, valid for 7 days. Connecting shares nothing until the patient chooses.</p>
        </form>
      ) : null}
    </div>
  );
}
