import { notFound } from 'next/navigation';
import { signIn } from '../actions';
import { isShowcase } from '@/lib/config';
import Link from 'next/link';

function Persona({ id, label }: { id: string; label: string }) {
  return (
    <form action={signIn} className="inline">
      <input type="hidden" name="userId" value={id} />
      <button className="btn" type="submit">Open as {label}</button>
    </form>
  );
}

export default function Tour() {
  if (!isShowcase()) notFound();
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-xs uppercase tracking-wide text-muted">Guided tour · about 3 minutes</p>
      <h1 className="mt-1 font-serif text-3xl">What you are about to see</h1>
      <p className="mt-3 text-muted">
        A psychologist&apos;s most valuable artifact is the case formulation: a working theory of how this person&apos;s difficulties connect. Today it lives in the clinician&apos;s head and is never tested against daily life. Project X lets clinician and patient build it together as a <b>Map</b>, checks it against the patient&apos;s own entries with the evidence one tap away, and gives it back to the patient as a <b>Playbook</b> they keep.
      </p>

      <ol className="mt-8 space-y-6">
        <li>
          <h2 className="font-serif text-xl">1. The psychologist&apos;s minute</h2>
          <p className="text-sm text-muted">Open Alex&apos;s Brief before a session. Notice: what changed against Alex&apos;s <i>own</i> usual, how the agreed experiments went, the pattern being tested, and what Alex wants to bring. Tap “View entries” on any line.</p>
          <div className="mt-2"><Persona id="c_lee" label="Dr. Lee" /></div>
        </li>
        <li>
          <h2 className="font-serif text-xl">2. The patient is in control</h2>
          <p className="text-sm text-muted">As Alex, open <b>You</b> and switch “Share my Map” off. Switch back to Dr. Lee: the Map and its statements are gone. Nothing private ever reaches the clinician, not even as a count.</p>
          <div className="mt-2"><Persona id="p_alex" label="Alex" /></div>
        </li>
        <li>
          <h2 className="font-serif text-xl">3. Today and the Map</h2>
          <p className="text-sm text-muted">Alex&apos;s Today is a 30-second ritual, not a form. My Map shows each link with where it comes from: seen in entries, a clinician&apos;s hypothesis, or Alex&apos;s own belief. Alex answers “yes, that is me”.</p>
        </li>
        <li>
          <h2 className="font-serif text-xl">4. Day zero</h2>
          <p className="text-sm text-muted">Jordan was just invited. Walk through onboarding: nothing is shared unless Jordan ticks it, and the first screen is never empty because the clinician already seeded a focus.</p>
          <div className="mt-2"><Persona id="p_jordan" label="Jordan" /></div>
        </li>
        <li>
          <h2 className="font-serif text-xl">5. After therapy</h2>
          <p className="text-sm text-muted">Riley has no clinician. The record, the Map and the Playbook still work, and nothing is shared with anyone.</p>
          <div className="mt-2"><Persona id="p_riley" label="Riley" /></div>
        </li>
      </ol>

      <section className="mt-10 rounded-xl border border-line bg-card p-4">
        <h2 className="font-serif text-xl">What is real, and what is still a prototype</h2>
        <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
          <li><b>Real:</b> the analysis engine, the privacy scoping, the typed and evidence-linked statements, the consent controls, and 40+ automated tests behind them.</li>
          <li><b>Synthetic:</b> all people and data on screen. The patterns in Alex&apos;s data were planted to demonstrate the engine.</li>
          <li><b>Pilot limits:</b> accounts and invite codes use single-server JSON storage; email verification, MFA and a production database are not built. It does not diagnose, predict or advise, and it is not monitored in real time.</li>
          <li><b>Unproven:</b> whether clinicians adopt it and whether patients keep logging. That is what the pilot is for.</li>
        </ul>
      </section>
      <p className="mt-6"><Link className="underline" href="/">Back</Link></p>
    </main>
  );
}
