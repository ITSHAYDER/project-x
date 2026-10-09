import Link from 'next/link';
import { redirect } from 'next/navigation';
import { logInAction } from '../actions';
import { isShowcase } from '@/lib/config';

export default function Login({ searchParams }: { searchParams: { error?: string } }) {
  if (isShowcase()) redirect('/');
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-serif text-3xl">Log in</h1>
      <p className="mt-2 text-muted">Your record is yours. Welcome back.</p>
      {searchParams.error ? <div role="alert" className="mt-4 rounded-lg border border-amber bg-amber-soft px-3 py-2 text-sm">{searchParams.error}</div> : null}
      <form action={logInAction} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="field" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" className="field" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button className="btn btn-primary w-full" type="submit">Log in</button>
      </form>
      <p className="mt-6 text-sm text-muted">New here? <Link className="underline" href="/signup">Create an account</Link></p>
      <p className="mt-6 text-xs text-muted">Not monitored in real time. Not for emergencies. If you are in crisis, contact your local emergency number.</p>
    </main>
  );
}
