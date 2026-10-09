import Link from 'next/link';
import { pageActor } from '@/lib/session';

export default function InvitePage({ searchParams }: { searchParams: { code?: string } }) {
  pageActor('clinician');
  const code = (searchParams.code ?? '').replace(/[^A-Z0-9-]/gi, '').slice(0, 9).toUpperCase();
  return (
    <div>
      <h1 className="font-serif text-2xl">Invite a patient</h1>
      {code ? (
        <>
          <p className="mt-2 text-muted">Give this code to your patient. It works once and expires in 7 days.</p>
          <p className="num my-6 rounded-xl border border-line bg-card p-6 text-center font-serif text-4xl tracking-widest" aria-label={`Invite code ${code}`}>{code}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            <li>They enter it when they sign up, or later under <b>You → Your clinician</b>.</li>
            <li>Connecting shares nothing. The patient decides what you can see.</li>
            <li>This code is shown here only. If you lose it, create another.</li>
            <li>Tell your patient plainly that the app is not monitored in real time and is not for emergencies.</li>
          </ul>
        </>
      ) : (
        <p className="mt-2 text-muted">No code to show. Create one from your Today page.</p>
      )}
      <p className="mt-6"><Link className="btn" href="/clinician">Back to Today</Link></p>
    </div>
  );
}
