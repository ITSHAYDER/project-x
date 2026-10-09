import Link from 'next/link';
import { signIn } from './actions';
import { USERS } from '@/lib/data/store';
import { isShowcase } from '@/lib/config';

export default function Home() {
  if (!isShowcase()) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="font-serif text-4xl leading-tight">Therapy has a working theory of you. Now you can watch how it holds up.</h1>
        <p className="mt-4 text-muted">
          A record of your own experience that you own, a Map you and your clinician build together, and a Playbook you keep. Your clinician sees only what you choose to share.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="btn btn-primary" href="/signup">Create an account</Link>
          <Link className="btn" href="/login">Log in</Link>
        </div>
        <p className="mt-8 text-sm text-muted">
          It does not diagnose, predict or give treatment advice, is not monitored in real time, and is not for emergencies. If you are in crisis, contact your local emergency number.
        </p>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-xs uppercase tracking-wide text-muted">Showcase · synthetic data only</p>
      <h1 className="mt-2 font-serif text-4xl leading-tight">Therapy has a working theory of you. Now you can watch how it holds up.</h1>
      <p className="mt-4 text-muted">
        A record of your own experience that you own, a Map you and your clinician build together, and a Playbook you keep. Your clinician sees only what you choose to share.
      </p>
      <p className="mt-4"><Link className="btn btn-primary" href="/tour">Take the 3-minute guided tour</Link></p>
      <h2 className="mt-10 font-serif text-xl">Or open it as someone</h2>
      <ul className="mt-3 space-y-3">
        {USERS.map((u) => (
          <li key={u.id}>
            <form action={signIn} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card p-4">
              <input type="hidden" name="userId" value={u.id} />
              <div>
                <div className="font-medium">{u.name} <span className="chip">{u.role}</span></div>
                <div className="text-sm text-muted">{u.blurb}</div>
              </div>
              <button className="btn btn-primary" type="submit">Open</button>
            </form>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-muted">
        This is a prototype. It does not diagnose, predict or give treatment advice, and it is not monitored in real time. If you are in crisis, contact local emergency services or a crisis line.
      </p>
    </main>
  );
}
