import { Shell } from '@/components/Shell';
import { pageActor } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default function ClinicianLayout({ children }: { children: React.ReactNode }) {
  const a = pageActor('clinician');
  return (
    <Shell items={[{ href: '/clinician', label: 'Today' }]} who={a.name}>
      {children}
    </Shell>
  );
}
