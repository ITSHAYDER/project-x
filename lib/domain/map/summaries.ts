import type { Day, MapEdge, PatientData } from '../types.ts';
import { addDays, prettyDay } from '../dates.ts';
import { fmt } from '../stats.ts';
import { chainEdgeEvidence } from './chains.ts';
import { prePost } from './interventions.ts';
import { pairEvidence } from '../insights/pairs.ts';
import { seriesOf } from '../insights/series.ts';
import { displayStatus } from '../insights/brief.ts';
import type { DisplayStatus } from '../insights/brief.ts';
import { toolEvidence } from '../playbook/whatHelps.ts';

export interface EdgeSummary {
  edge: MapEdge;
  fromLabel: string;
  toLabel: string;
  shown: DisplayStatus;
  /** distinct days of evidence (drives line thickness); 0 when none */
  days: number;
  text: string;
  sourceRefs: string[];
}

/** Non-causal wording only. `d` must already be viewer-scoped. */
export function edgeSummaries(d: PatientData, asOf: Day): EdgeSummary[] {
  const node = (id: string) => d.nodes.find((n) => n.id === id);
  const out: EdgeSummary[] = [];
  for (const edge of d.edges) {
    const a = node(edge.from);
    const b = node(edge.to);
    if (!a || !b) continue;
    let days = 0;
    let text = 'No entries yet. This is a belief or hypothesis, not something seen in the data.';
    let refs: string[] = [];
    let ev = chainEdgeEvidence(d.moments, edge.from, edge.to);
    let observed = ev.status === 'observed';

    if (ev.status !== 'none' && ev.firstDay) {
      days = ev.days;
      refs = ev.momentIds;
      text = `Seen in ${ev.moments} Moments on ${ev.days} days since ${prettyDay(ev.firstDay)}${ev.status === 'emerging' ? ' (emerging)' : ''}.`;
    } else if (a.signalId && b.signalId) {
      const focus = d.focusItems.find((f) => f.pair && f.pair.a === a.signalId && f.pair.b === b.signalId);
      if (focus?.pair) {
        const r = pairEvidence(seriesOf(d.entries, a.signalId), seriesOf(d.entries, b.signalId), focus.pair.aState, focus.pair.bState, focus.pair.lag, addDays(asOf, -83), asOf);
        if (r.status === 'ok') {
          days = r.nPairs;
          refs = r.sourceRefs.slice(0, 40);
          observed = r.verdict === 'present';
          text = `On ${r.bWhenA} of ${r.aStateDays} days when ${a.label.toLowerCase()} was ${focus.pair.aState}, ${b.label.toLowerCase()} was ${focus.pair.bState}; on other days: ${r.bWhenOther} of ${r.otherDays}. A pattern in the reported data, not a cause.`;
        } else text = `Not enough entries yet (${r.have} of ${r.need}) to look at this.`;
      }
    } else if (a.kind === 'intervention' && b.signalId) {
      const focus = d.focusItems.find((f) => f.kind === 'experiment' && f.title.toLowerCase() === a.label.toLowerCase());
      const tool = d.tools.find((t) => t.label.toLowerCase() === a.label.toLowerCase());
      if (focus) {
        const r = prePost(seriesOf(d.entries, b.signalId), focus.startDay, asOf);
        if (r.status === 'ok') {
          days = r.nAfter;
          refs = r.sourceRefs.slice(0, 40);
          observed = true;
          text = `Since ${prettyDay(focus.startDay)}: ${b.label.toLowerCase()} median ${fmt(r.afterMedian)} vs ${fmt(r.beforeMedian)} in the 14 days before (${r.nAfter} and ${r.nBefore} entries).`;
        }
      } else if (tool) {
        const sig = d.signals.find((s) => s.id === tool.outcomeSignalId);
        if (sig) {
          const r = toolEvidence(d.toolUses.filter((u) => u.toolId === tool.id), seriesOf(d.entries, sig.id), sig);
          if (r.status === 'ok') {
            days = r.uses;
            observed = r.verdict === 'more_often_better';
            text = `On ${r.betterWith} of ${r.uses} days with it, ${sig.label.toLowerCase()} was better than usual; on other days: ${r.betterWithout} of ${r.without}. A pattern, not a cause.`;
          }
        }
      }
    }
    // The "observed" label is computed here from the viewer's scoped data; never stored.
    const shown: DisplayStatus =
      edge.status === 'confirmed_together' ? 'confirmed_together' : observed ? 'observed' : displayStatus(edge, ev.status === 'none' ? null : ev);
    out.push({ edge, fromLabel: a.label, toLabel: b.label, shown, days, text, sourceRefs: refs });
  }
  return out;
}
