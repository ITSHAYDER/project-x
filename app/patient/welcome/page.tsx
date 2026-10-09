import { pagePatient } from '@/lib/session';
import { completeOnboardingAction } from '@/app/actions';
import { SIGNAL_SUGGESTIONS } from '@/lib/domain/signals';
import { nameOf } from '@/lib/data/store';
import { ErrorNote } from '@/components/Shell';
import { ShowcaseNote } from '@/components/ShowcaseNote';
import { redirect } from 'next/navigation';
import type { Scope } from '@/lib/domain/types';

const SCOPES: Array<{ id: Scope; title: string; example: string }> = [
  { id: 'share_checkins', title: 'Share my check-ins', example: 'Your clinician can see the signals you mark as shared, such as sleep.' },
  { id: 'share_assessments', title: 'Share my questionnaire results', example: 'They see the totals of questionnaires like the GAD-7, never a diagnosis.' },
  { id: 'share_map', title: 'Share my Map', example: 'They see links you confirmed together or that appear in Moments you shared.' },
  { id: 'share_focus', title: 'Share what I am working on', example: 'They see your check-ins on agreed focus items.' },
  { id: 'share_moments_default', title: 'Share new Moments by default', example: 'New Moments start as shared. You can still make any one private.' },
  { id: 'allow_ai_analysis', title: 'Allow AI to smooth the wording of my summary', example: 'Wording only. It never sees your journal or private Moments.' },
];

export default function Welcome({ searchParams }: { searchParams: { error?: string } }) {
  const { data } = pagePatient({ allowUnonboarded: true });
  if (data.onboarded) redirect('/patient/today');
  const clinician = data.linkedClinicianId ? { name: nameOf(data.linkedClinicianId) } : null;
  const tzList = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return (
    <div>
      <ErrorNote error={searchParams.error} />
      <p className="text-xs uppercase tracking-wide text-muted">Two minutes · you can change everything later</p>
      <h1 className="mt-1 font-serif text-3xl">Welcome, {data.displayName}</h1>
      <p className="mt-3 font-serif text-lg">
        This is a record of your own experience. It belongs to you. {clinician ? `${clinician.name} will only see what you choose to share, and only when they open it.` : 'Nothing is shared with anyone.'}
      </p>
      <ul className="mt-3 list-disc pl-5 text-sm text-muted space-y-1">
        <li>It is not monitored in real time and cannot respond to emergencies. If you are in crisis, contact local emergency services.</li>
        <li>It does not diagnose, predict or give advice. It shows patterns in what you report, with the entries behind them.</li>
        <li>Private stays private. Nothing is shared unless you switch it on below.</li>
      </ul>

      {data.focusItems.length > 0 ? (
        <section className="mt-6 rounded-xl border border-line bg-card p-4">
          <h2 className="font-serif text-lg">{clinician ? `${clinician.name} suggested` : 'To start with'}</h2>
          <ul className="mt-1 space-y-1">{data.focusItems.map((f) => <li key={f.id} className="font-serif">{f.title}</li>)}</ul>
        </section>
      ) : null}

      <form action={completeOnboardingAction} className="mt-8 space-y-8">
        <fieldset>
          <legend className="font-serif text-xl">What would you like to keep track of?</legend>
          <p className="text-sm text-muted">Choose up to five. You can add your own later.</p>
          <ul className="mt-3 space-y-2">
            {SIGNAL_SUGGESTIONS.map((s) => (
              <li key={s.id}>
                <label className="flex items-start gap-3 rounded-xl border border-line bg-card p-3">
                  <input type="checkbox" name="signal" value={s.id} defaultChecked={s.id === 'sleep' || s.id === 'anxiety'} className="mt-1" />
                  <span><span className="font-medium">{s.label}</span><br /><span className="text-sm text-muted">{s.why}</span></span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset>
          <legend className="font-serif text-xl">What may {clinician ? clinician.name : 'a clinician'} see?</legend>
          <p className="text-sm text-muted">Everything is off until you switch it on.</p>
          <ul className="mt-3 space-y-2">
            {SCOPES.map((s) => (
              <li key={s.id}>
                <label className="flex items-start gap-3 rounded-xl border border-line bg-card p-3">
                  <input type="checkbox" name={`consent_${s.id}`} className="mt-1" />
                  <span><span className="font-medium">{s.title}</span><br /><span className="text-sm text-muted">{s.example}</span></span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <div>
          <label className="label" htmlFor="tz">Your time zone (decides what “morning” and “today” mean)</label>
          <input id="tz" className="field" name="timezone" list="tzlist" defaultValue={data.timezone} />
          <datalist id="tzlist">{tzList.map((z) => <option key={z} value={z} />)}</datalist>
        </div>
        <button className="btn btn-primary" type="submit">Start</button>
      </form>
      <ShowcaseNote title="Presenter note">
        This is the day-zero experience. Nothing is shared by default, the clinician&apos;s suggested focus is already here, and the patient chooses signals and sharing in plain language before anything is recorded.
      </ShowcaseNote>
    </div>
  );
}
