import { NavLinks } from './Nav';
import { signOut } from '@/app/actions';
import Link from 'next/link';
import { isShowcase, allowRealPatientData } from '@/lib/config';

export function Shell({ items, who, children }: { items: Array<{ href: string; label: string }>; who: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      {isShowcase() ? (
        <div className="bg-amber-soft text-amber text-xs text-center py-1" role="note">
          Showcase with synthetic data only. Not a medical device. Not for emergencies.{' '}
          <Link href="/tour" className="underline">Guided tour</Link>
        </div>
      ) : !allowRealPatientData() ? (
        <div className="bg-amber-soft text-amber text-xs text-center py-1" role="note">
          Synthetic data only until the go-live checklist is complete. Not for emergencies.
        </div>
      ) : null}
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="font-serif text-lg">Project X</span>
            <NavLinks items={items} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Link href="/patient/support" className="underline">Need urgent help?</Link>
            <span>{who}</span>
            <form action={signOut}>
              <button className="btn" type="submit">Switch</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 pb-24">{children}</main>
    </div>
  );
}

export function ErrorNote({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div role="alert" className="mb-4 rounded-lg border border-amber bg-amber-soft px-3 py-2 text-sm">
      {error}
    </div>
  );
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-xl">{title}</h2>
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}
