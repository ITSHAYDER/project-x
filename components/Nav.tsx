'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLinks({ items }: { items: Array<{ href: string; label: string }> }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto">
      {items.map((i) => {
        const active = path === i.href || path.startsWith(i.href + '/');
        return (
          <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined} className={`rounded-lg px-3 py-2 text-sm min-h-[44px] flex items-center ${active ? 'bg-accent-soft text-ink font-semibold' : 'text-muted hover:text-ink'}`}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
