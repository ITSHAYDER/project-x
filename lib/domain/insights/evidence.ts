import type { PatientData } from '../types.ts';
import { prettyDay } from '../dates.ts';

/** Turn source ids into human-readable lines. `d` must be the VIEWER-SCOPED data, so a clinician can never see more. */
export function evidenceLines(d: PatientData, refs: string[], limit = 12): string[] {
  const out: string[] = [];
  const label = (id: string) => d.nodes.find((n) => n.id === id)?.label ?? id;
  const seen = new Set<string>();
  for (const r of refs) {
    if (out.length >= limit) break;
    if (seen.has(r)) continue;
    seen.add(r);
    const e = d.entries.find((x) => x.id === r);
    if (e) {
      const s = d.signals.find((x) => x.id === e.signalId);
      out.push(`${prettyDay(e.day)} · ${s?.label ?? e.signalId}: ${e.value}${s?.unit ? ' ' + s.unit : ''}`);
      continue;
    }
    const m = d.moments.find((x) => x.id === r);
    if (m) {
      out.push(`${prettyDay(m.day)} · ${m.chain.map(label).join(' → ')}`);
      continue;
    }
    const c = d.focusChecks.find((x) => x.id === r);
    if (c) {
      const f = d.focusItems.find((x) => x.id === c.focusId);
      out.push(`${prettyDay(c.day)} · ${f?.title ?? 'focus'}: ${c.status.replace('_', ' ')}${c.obstacle ? ` (${c.obstacle})` : ''}`);
      continue;
    }
    const a = d.agenda.find((x) => x.id === r);
    if (a) {
      out.push(`${prettyDay(a.day)} · agenda: ${a.text}`);
      continue;
    }
    const g = d.focusItems.find((x) => x.id === r);
    if (g) {
      out.push(`${g.kind}: ${g.title}${g.steps ? ' (' + g.steps.map((s) => (s.done ? '✓ ' : '○ ') + s.text).join('; ') + ')' : ''}`);
      continue;
    }
    const as = d.assessments.find((x) => x.id === r);
    if (as) out.push(`${prettyDay(as.day)} · GAD-7 total ${as.total} (answers ${as.answers.join(',')})`);
  }
  return out;
}
