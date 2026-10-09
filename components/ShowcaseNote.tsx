import { isShowcase } from '@/lib/config';

/** Presenter hint, visible ONLY in the showcase build. Never rendered in product mode. */
export function ShowcaseNote({ title = 'Look for this', children }: { title?: string; children: React.ReactNode }) {
  if (!isShowcase()) return null;
  return (
    <aside className="mt-6 rounded-xl border border-dashed border-accent bg-accent-soft p-3 text-sm" aria-label="Presenter note">
      <div className="text-xs uppercase tracking-wide text-accent">{title}</div>
      <div className="mt-1">{children}</div>
    </aside>
  );
}
