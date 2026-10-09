import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signUpAction } from '../actions';
import { isShowcase } from '@/lib/config';
import { TzField } from '@/components/TzField';
import { clinicianCodeConfigured } from '@/lib/auth/service';

export default function SignUp({ searchParams }: { searchParams: { error?: string; role?: string } }) {
  if (isShowcase()) redirect('/');
  const clinicianOpen = clinicianCodeConfigured();
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-serif text-3xl">Create your account</h1>
      <p className="mt-2 text-muted">A record of your own experience that you own. You choose what anyone else sees.</p>
      {searchParams.error ? <div role="alert" className="mt-4 rounded-lg border border-amber bg-amber-soft px-3 py-2 text-sm">{searchParams.error}</div> : null}
      <form action={signUpAction} className="mt-6 space-y-4">
        <TzField />
        <fieldset>
          <legend className="label">I am signing up as</legend>
          <div className="flex gap-3">
            <label className="chip"><input type="radio" name="role" value="patient" defaultChecked={searchParams.role !== 'clinician'} /> A person keeping a record</label>
            {clinicianOpen ? <label className="chip"><input type="radio" name="role" value="clinician" defaultChecked={searchParams.role === 'clinician'} /> A clinician</label> : null}
          </div>
          {!clinicianOpen ? <p className="mt-1 text-xs text-muted">Clinician sign-up is by access code during the pilot.</p> : null}
        </fieldset>
        <div>
          <label className="label" htmlFor="name">First name or nickname</label>
          <input id="name" className="field" name="name" maxLength={60} autoComplete="given-name" required />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="field" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password (at least 10 characters)</label>
          <input id="password" className="field" name="password" type="password" minLength={10} autoComplete="new-password" required />
        </div>
        <div>
          <label className="label" htmlFor="inviteCode">Invite code from your clinician (optional)</label>
          <input id="inviteCode" className="field" name="inviteCode" maxLength={12} placeholder="ABCD-EFGH" autoComplete="off" />
          <p className="mt-1 text-xs text-muted">Even with a code, nothing is shared until you choose.</p>
        </div>
        {clinicianOpen ? (
          <div>
            <label className="label" htmlFor="clinicianCode">Clinician access code (clinicians only)</label>
            <input id="clinicianCode" className="field" name="clinicianCode" type="password" autoComplete="off" />
          </div>
        ) : null}
        <button className="btn btn-primary w-full" type="submit">Create account</button>
      </form>
      <p className="mt-6 text-sm text-muted">Already have one? <Link className="underline" href="/login">Log in</Link></p>
      <p className="mt-6 text-xs text-muted">This does not diagnose, predict or give treatment advice. It is not monitored in real time and is not for emergencies.</p>
    </main>
  );
}
