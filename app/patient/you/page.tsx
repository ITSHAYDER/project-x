import Link from 'next/link';
import { pagePatient } from '@/lib/session';
import { scopeFor } from '@/lib/domain/insights/scope';
import { edgeSummaries } from '@/lib/domain/map/summaries';
import { todayIn, prettyDay } from '@/lib/domain/dates';
import { setConsentAction, toggleSignalShare, resetDemo, createSignalAction, toggleSignalActiveAction, setTimezoneAction, connectClinicianAction, disconnectClinicianAction, deleteAccountAction } from '@/app/actions';
import { isShowcase } from '@/lib/config';
import { ErrorNote } from '@/components/Shell';
import { ShowcaseNote } from '@/components/ShowcaseNote';
import { MAX_ACTIVE_SIGNALS, activeCount } from '@/lib/domain/signals';
import { Section } from '@/components/Shell';
import { auditFor, nameOf } from '@/lib/data/store';
import type { Scope } from '@/lib/domain/types';

const SCOPE_TEXT: Record<Scope, { title: string; example: string }> = {
  share_checkins: { title: 'Share my check-ins', example: 'Lets your clinician see the signals you mark as shared, such as sleep.' },
  share_moments_default: { title: 'Share new Moments by default', example: 'New Moments start as shared. You can still make any one private.' },
  share_map: { title: 'Share my Map', example: 'Your clinician sees links that are confirmed together or supported by Moments you shared.' },
  share_early_signs: { title: 'Share my early signs', example: 'Shows the looking-back patterns in your Playbook. Never sent as an alert.' },
  share_assessments: { title: 'Share my questionnaire results', example: 'Lets your clinician see totals of questionnaires such as the GAD-7. Never a diagnosis.' },
  share_focus: { title: 'Share what I am working on', example: 'Lets your clinician see your check-ins on agreed focus items.' },
  allow_ai_analysis: { title: 'Allow AI wording for my clinician’s summary', example: 'Re-words computed statements only. Never sees your journal or private Moments.' },
};

export default function You({ searchParams }: { searchParams: { error?: string } }) {
  const { actor, data } = pagePatient();
  const tzList = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  const today = todayIn(data.timezone);
  const clinician = data.linkedClinicianId ? { id: data.linkedClinicianId, name: nameOf(data.linkedClinicianId) } : null;
  const view = clinician ? scopeFor(data, { role: 'clinician', clinicianId: clinician.id, patientId: actor.id }) : null;
  const visibleEdges = view ? edgeSummaries(view, today).length : 0;
  const log = auditFor(actor.id).filter((a) => a.actorRole === 'clinician');
  return (
    <div>
      <ErrorNote error={searchParams.error} />
      <h1 className="font-serif text-2xl">You</h1>
      <p className="mt-1 text-muted">This record is yours. Your clinician sees only what is switched on here, and you can change it any time.</p>

      <Section title="What my clinician can see right now">
        {clinician && view ? (
          <div className="rounded-xl border border-line bg-card p-4 text-sm">
            <p className="font-medium">{clinician.name}</p>
            <ul className="mt-2 space-y-1">
              <li>Signals: {view.signals.length ? view.signals.map((s) => s.label).join(', ') : 'none'}</li>
              <li>Moments: {view.moments.length} shared</li>
              <li>Journal entries: {view.journal.length} shared</li>
              <li>Things to bring: {view.agenda.length} shared</li>
              <li>Map links visible: {visibleEdges}</li>
              <li>Early signs: {data.consents.share_early_signs ? 'shared' : 'not shared'}</li>
              <li>AI wording: {data.consents.allow_ai_analysis ? 'allowed' : 'not allowed'}</li>
            </ul>
          </div>
        ) : (
          <p className="rounded-xl border border-line bg-card p-4">No clinician is connected. Nothing is shared with anyone. Your record keeps working on its own.</p>
        )}
      </Section>

      <Section title="Your clinician" hint="You can connect or disconnect any time. Disconnecting stops their access at once and keeps everything you recorded.">
        {clinician ? (
          <form action={disconnectClinicianAction} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card p-4">
            <span>Connected to <b>{clinician.name}</b></span>
            <button className="btn" type="submit">Disconnect</button>
          </form>
        ) : (
          <form action={connectClinicianAction} className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-card p-4">
            <div className="grow">
              <label className="label" htmlFor="ic">Invite code from your clinician</label>
              <input id="ic" className="field" name="inviteCode" maxLength={12} placeholder="ABCD-EFGH" autoComplete="off" required />
            </div>
            <button className="btn btn-primary" type="submit">Connect</button>
            <p className="w-full text-xs text-muted">Connecting shares nothing by itself. You decide below what they can see.</p>
          </form>
        )}
      </Section>

      <Section title="Sharing controls">
        <ul className="space-y-3">
          {(Object.keys(SCOPE_TEXT) as Scope[]).map((sc) => (
            <li key={sc} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card p-3">
              <div>
                <div className="font-medium">{SCOPE_TEXT[sc].title}</div>
                <div className="text-sm text-muted">{SCOPE_TEXT[sc].example}</div>
              </div>
              <form action={setConsentAction}>
                <input type="hidden" name="scope" value={sc} />
                <input type="hidden" name="value" value={String(!data.consents[sc])} />
                <button className="btn" type="submit" aria-pressed={data.consents[sc]}>{data.consents[sc] ? 'On' : 'Off'}</button>
              </form>
            </li>
          ))}
        </ul>
        <h3 className="mt-6 font-medium">Which signals</h3>
        <ul className="mt-2 space-y-2">
          {data.signals.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-xl border border-line bg-card p-3">
              <span>{s.label}</span>
              <form action={toggleSignalShare}>
                <input type="hidden" name="signalId" value={s.id} />
                <input type="hidden" name="value" value={String(!s.shared)} />
                <button className="btn" type="submit" aria-pressed={s.shared}>{s.shared ? 'Shared' : 'Private'}</button>
              </form>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="What you track" hint={`Up to ${MAX_ACTIVE_SIGNALS} at once (${activeCount(data.signals)} active). Pausing keeps the history.`}>
        <ul className="space-y-2">
          {data.signals.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card p-3">
              <div>
                <span className="font-medium">{s.label}</span>
                <span className="ml-2 text-xs text-muted">{s.kind.replace('_', ' ')}{s.unit ? `, ${s.unit}` : ''} · {s.cadence} · {s.window === 'any' ? 'any time' : s.window}</span>
              </div>
              <form action={toggleSignalActiveAction}>
                <input type="hidden" name="signalId" value={s.id} />
                <input type="hidden" name="active" value={String(!s.active)} />
                <button className="btn" type="submit">{s.active ? 'Pause' : 'Resume'}</button>
              </form>
            </li>
          ))}
          {data.signals.length === 0 ? <li className="text-muted">Nothing yet. Add what matters to you below.</li> : null}
        </ul>
        <form action={createSignalAction} className="mt-4 grid gap-3 rounded-xl border border-line bg-card p-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="sl">Something you want to track</label>
            <input id="sl" className="field" name="label" maxLength={40} placeholder="e.g. Time with friends, Headaches, Hours of focus" required />
          </div>
          <div>
            <label className="label" htmlFor="sk">How you will record it</label>
            <select id="sk" className="field" name="kind" defaultValue="scale_0_10">
              <option value="scale_0_10">A rating from 0 to 10</option>
              <option value="hours">Hours</option>
              <option value="count">A count</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="su">Unit (optional)</label>
            <input id="su" className="field" name="unit" maxLength={10} placeholder="h, cups, ..." />
          </div>
          <div>
            <label className="label" htmlFor="sd">Higher is…</label>
            <select id="sd" className="field" name="direction" defaultValue="higher_is_better">
              <option value="higher_is_better">better for me</option>
              <option value="higher_is_harder">harder for me</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="sc">How often</label>
            <select id="sc" className="field" name="cadence" defaultValue="daily"><option value="daily">Daily</option><option value="weekly">Weekly</option></select>
          </div>
          <div>
            <label className="label" htmlFor="sw">When to ask</label>
            <select id="sw" className="field" name="window" defaultValue="evening"><option value="morning">Morning</option><option value="evening">Evening</option><option value="any">Any time</option></select>
          </div>
          <div className="flex items-end"><button className="btn btn-primary" type="submit">Add</button></div>
          <p className="sm:col-span-2 text-xs text-muted">New signals are private. You decide below whether your clinician can see each one.</p>
        </form>
      </Section>

      <Section title="Your time zone" hint="Decides what “today” and “morning” mean for you.">
        <form action={setTimezoneAction} className="flex gap-2">
          <input className="field" name="timezone" list="tzlist" defaultValue={data.timezone} aria-label="Time zone" required />
          <datalist id="tzlist">{tzList.map((z) => <option key={z} value={z} />)}</datalist>
          <button className="btn" type="submit">Save</button>
        </form>
      </Section>

      <Section title="Who looked" hint="Content-free record of when your clinician opened your summary.">
        <ul className="space-y-1 text-sm text-muted num">
          {log.map((a) => <li key={a.id}>{new Date(a.at).toLocaleString('en-GB')} · {a.action}</li>)}
          {log.length === 0 ? <li>No clinician has opened your record in this demo session.</li> : null}
        </ul>
      </Section>

      <Section title="Your data">
        <div className="flex flex-wrap gap-2">
          <a className="btn" href="/api/export" download={`project-x-${actor.id}-${today}.json`}>Export everything (JSON)</a>
          {isShowcase() ? <form action={resetDemo}><button className="btn" type="submit">Reset demo data</button></form> : null}
        </div>
        <p className="mt-2 text-xs text-muted">In the real product, deletion removes your rows and records a content-free audit event. Last updated {prettyDay(today)}. <Link className="underline" href="/patient/support">Need urgent help?</Link></p>
      </Section>
      {!isShowcase() ? (
        <Section title="Delete my account" hint="Removes your account and everything you recorded. This cannot be undone.">
          <form action={deleteAccountAction} className="space-y-2 rounded-xl border border-line bg-card p-4">
            <label className="label" htmlFor="dp">Your password</label>
            <input id="dp" className="field" name="password" type="password" autoComplete="current-password" required />
            <label className="chip"><input type="checkbox" name="confirm" /> I understand this deletes everything</label>
            <div><button className="btn" type="submit">Delete my account</button></div>
          </form>
        </Section>
      ) : null}

      <ShowcaseNote>
        Switch “Share my Map” or “Share my check-ins” off, then open the clinician&apos;s Brief: the statements built from them disappear on the next read. Nothing private is ever shown to the clinician, not even as a count.
      </ShowcaseNote>
    </div>
  );
}
