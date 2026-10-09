import type { Day, PatientData, Viewer } from '../types.ts';
import { fmt } from '../stats.ts';
import { seriesOf } from '../insights/series.ts';
import { scopeFor } from '../insights/scope.ts';
import { earlySigns } from './earlySigns.ts';
import type { EarlySignResult } from './earlySigns.ts';
import { toolEvidence } from './whatHelps.ts';
import type { ToolEvidence } from './whatHelps.ts';
import type { Insufficient } from '../types.ts';

export interface PlaybookView {
  anchorLabel: string | null;
  early: { result: EarlySignResult | Insufficient; lines: Array<{ text: string; label: 'tentative' | 'candidate' }> } | null;
  helps: Array<{ toolId: string; label: string; evidence: ToolEvidence | Insufficient; text: string }>;
}

export function playbook(full: PatientData, viewer: Viewer, asOf: Day): PlaybookView {
  const d = scopeFor(full, viewer);
  const canEarly = viewer.role === 'patient' || full.consents.share_early_signs;
  const anchor = d.signals.find((s) => s.id === 'energy') ?? d.signals.find((s) => s.higherIsBetter) ?? d.signals[0];
  let early: PlaybookView['early'] = null;
  if (anchor && canEarly) {
    const others = d.signals.map((s) => ({ signal: s, series: seriesOf(d.entries, s.id) }));
    const result = earlySigns(anchor, seriesOf(d.entries, anchor.id), others, asOf);
    const lines: Array<{ text: string; label: 'tentative' | 'candidate' }> = [];
    if (result.status === 'ok') {
      for (const s of result.signs) {
        const sig = d.signals.find((x) => x.id === s.signalId);
        if (!sig) continue;
        lines.push({
          label: s.label,
          text: `Before ${s.periodsShifted} of ${s.periodsEvaluated} harder periods (${anchor.label.toLowerCase()} in its worse range for 3+ days), ${sig.label.toLowerCase()} had already been ${s.direction} than usual, about ${fmt(s.medianLeadDays)} days earlier. A pattern looking back; not a prediction.`,
        });
      }
    }
    early = { result, lines };
  }
  const helps = d.tools.map((t) => {
    const sig = d.signals.find((s) => s.id === t.outcomeSignalId);
    if (!sig) return { toolId: t.id, label: t.label, evidence: { status: 'insufficient', have: 0, need: 6, unlocks: 'a comparison' } as Insufficient, text: 'No outcome signal is shared.' };
    const ev = toolEvidence(d.toolUses.filter((u) => u.toolId === t.id), seriesOf(d.entries, sig.id), sig);
    let text: string;
    if (ev.status === 'ok') {
      const more = ev.verdict === 'more_often_better' ? 'more often' : ev.verdict === 'less_often_better' ? 'less often' : 'about as often';
      text = `On ${ev.betterWith} of ${ev.uses} days you used it, ${sig.label.toLowerCase()} was better than your usual; on other days: ${ev.betterWithout} of ${ev.without}. Better ${more} on days with it. A pattern, not a cause.`;
    } else text = `Not enough uses yet (${ev.have} of ${ev.need}) to compare days with and without it.`;
    return { toolId: t.id, label: t.label, evidence: ev, text };
  });
  return { anchorLabel: anchor?.label ?? null, early, helps };
}
