import type { PatientData, Statement } from '@/lib/domain/types';
import { evidenceLines } from '@/lib/domain/insights/evidence';

const LABEL: Record<Statement['type'], string> = {
  REPORTED: 'Reported',
  OBSERVED: 'Observed pattern',
  TOPIC: 'Possible topic, not a finding',
};

/** Every statement shows its type and a way to inspect the evidence behind it. */
export function StatementList({ statements, scoped, polished }: { statements: Statement[]; scoped: PatientData; polished?: Map<string, string> }) {
  if (statements.length === 0) return null;
  return (
    <ul className="space-y-4">
      {statements.map((s) => {
        const lines = evidenceLines(scoped, s.sourceRefs);
        const text = polished?.get(s.id) ?? s.text;
        return (
          <li key={s.id} className={`st-${s.type} py-1`}>
            <div className="text-xs uppercase tracking-wide text-muted">{LABEL[s.type]}{polished?.has(s.id) ? ' · AI wording, verified' : ''}</div>
            <p className={s.section === 'bring' ? 'font-serif text-lg' : ''}>{text}</p>
            {lines.length > 0 ? (
              <details className="mt-1 text-sm">
                <summary className="cursor-pointer text-muted">View entries ({s.sourceRefs.length})</summary>
                <ul className="mt-1 space-y-0.5 text-muted num">
                  {lines.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
