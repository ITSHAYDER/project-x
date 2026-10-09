import { Shell } from '@/components/Shell';
import { pageActor } from '@/lib/session';

const ITEMS = [
  { href: '/patient/today', label: 'Today' },
  { href: '/patient/goals', label: 'Goals' },
  { href: '/patient/anxiety', label: 'Anxiety' },
  { href: '/patient/map', label: 'My Map' },
  { href: '/patient/history', label: 'History' },
  { href: '/patient/journal', label: 'Journal' },
  { href: '/patient/you', label: 'You' },
];
export const dynamic = 'force-dynamic';

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const a = pageActor('patient');
  return (
    <Shell items={ITEMS} who={a.name}>
      {children}
    </Shell>
  );
}
