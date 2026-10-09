import type { Day, MapEdge, PatientData, Statement, Viewer, Insufficient } from '../types.ts';
import { addDays, prettyDay } from '../dates.ts';
import { fmt } from '../stats.ts';
import { seriesOf, lastDays } from './series.ts';
import { computeBaseline, detectShift, comparePeriods } from './baseline.ts';
import { pairEvidence } from './pairs.ts';
import { scopeFor } from './scope.ts';
import { chainEdgeEvidence, chainTrend, proposeEdges } from '../map/chains.ts';
import type { ChainEvidence } from '../map/chains.ts';
import { prePost } from '../map/interventions.ts';
import { CONFIG } from './config.ts';
import { goalProgress } from '../goals.ts';
import { gad7Change } from '../gad7.ts';

export interface Coverage {
  have: number;
  expected: number;
  days: number;
}
export interface BriefResult {
  statements: Statement[];
  coverage: Coverage;
  notes: Array<{ label: string; info: Insufficient }>;
}

export type DisplayStatus = 'observed' | 'emerging' | MapEdge['status'];

/** "Observed" is computed at read time from the viewer's scoped data; it is never stored. */
export function displayStatus(edge: MapEdge, ev: ChainEvidence | null): DisplayStatus {
  if (edge.status === 'confirmed_together') return 'confirmed_together';
  if (ev && ev.status === 'observed') return 'observed';
  if (ev && ev.status === 'emerging' && (edge.status === 'proposed' || edge.status === 'patient_belief')) return 'emerging';
  return edge.status;
}

export function computeBrief(full: PatientData, viewer: Viewer, asOf: Day): BriefResult {
  const d = scopeFor(full, viewer);
  const you = viewer.role === 'patient';
  const P = you ? 'Your' : "The patient's";
  const p = you ? 'your' : 'their';
  const statements: Statement[] = [];
  const notes: BriefResult['notes'] = [];
  const label = (id: string) => d.signals.find((s) => s.id === id)?.label.toLowerCase() ?? id;
  const unit = (id: string) => {
    const u = d.signals.find((s) => s.id === id)?.unit;
    return u ? ` ${u}` : '';
  };

  // 1) What changed / stayed stable, per signal, against the person's own baseline
  for (const s of d.signals) {
    const series = seriesOf(d.entries, s.id);
    const shift = detectShift(s, series, asOf);
    const base = computeBaseline(series, asOf);
    if (shift) {
      const word = shift.direction;
      statements.push({
        id: `shift:${s.id}`,
        type: 'OBSERVED',
        key: 'shift',
        section: 'changed',
        sourceRefs: shift.sourceRefs,
        text: `${P} ${label(s.id)} has been ${word} than ${p} usual: median ${fmt(shift.current)}${unit(s.id)} over the last 7 days vs a usual ${fmt(shift.usual)}${unit(s.id)} (${shift.sideCount} of ${shift.of} entries ${word === 'lower' ? 'below' : 'above'} usual).`,
      });
      continue;
    }
    if (base.status !== 'ok') {
      notes.push({ label: s.label, info: base });
      continue;
    }
    const cmp = comparePeriods(s.id, series, asOf);
    const recent = lastDays(series, asOf, 7);
    if (cmp.status === 'ok' && Math.abs(cmp.diff) >= (CONFIG.minStep[s.kind] ?? 1)) {
      statements.push({
        id: `cmp:${s.id}`,
        type: 'OBSERVED',
        key: 'compare',
        section: 'changed',
        sourceRefs: recent.flatMap((x) => x.ids),
        text: `${P} ${label(s.id)} median was ${fmt(cmp.thisMedian)}${unit(s.id)} this week and ${fmt(cmp.lastMedian)}${unit(s.id)} the week before (${cmp.nThis} and ${cmp.nLast} entries).`,
      });
    } else if (recent.length >= CONFIG.shiftMinEntries) {
      statements.push({
        id: `stable:${s.id}`,
        type: 'OBSERVED',
        key: 'stable',
        section: 'stable',
        sourceRefs: recent.flatMap((x) => x.ids),
        text: `${P} ${label(s.id)} has stayed within ${p} usual range (usual ${fmt(base.median)}${unit(s.id)}).`,
      });
    }
  }

  // 2) Focus items: pre-declared pairs, interventions, commitments
  const from84 = addDays(asOf, -83);
  for (const f of d.focusItems.filter((x) => x.status === 'active')) {
    if (f.pair) {
      const a = seriesOf(d.entries, f.pair.a);
      const b = seriesOf(d.entries, f.pair.b);
      const ev = pairEvidence(a, b, f.pair.aState, f.pair.bState, f.pair.lag, from84, asOf);
      if (ev.status === 'ok') {
        const when = f.pair.lag === 1 ? 'the next day' : 'the same day';
        const base = `On ${ev.bWhenA} of ${ev.aStateDays} days when ${p} ${label(f.pair.a)} was ${f.pair.aState}, ${p} ${label(f.pair.b)} was ${f.pair.bState} ${when}; on other days: ${ev.bWhenOther} of ${ev.otherDays}.`;
        const tail = ev.verdict === 'not_seen' ? ' No clear difference in the reported data.' : ' This is a pattern in the reported data, not a cause.';
        statements.push({ id: `pair:${f.id}`, type: 'OBSERVED', key: 'pair', section: 'focus', sourceRefs: ev.sourceRefs.slice(0, 40), text: `“${f.title}”: ${base}${tail}` });
      } else notes.push({ label: f.title, info: ev });
    } else if (f.kind === 'experiment' && f.signalIds[0]) {
      const sid = f.signalIds[0];
      const r = prePost(seriesOf(d.entries, sid), f.startDay, asOf);
      if (r.status === 'ok') {
        statements.push({
          id: `prepost:${f.id}`,
          type: 'OBSERVED',
          key: 'prepost',
          section: 'focus',
          sourceRefs: r.sourceRefs.slice(0, 40),
          text: `Since ${prettyDay(f.startDay)} (“${f.title}”): ${p} ${label(sid)} median ${fmt(r.afterMedian)}${unit(sid)} vs ${fmt(r.beforeMedian)}${unit(sid)} in the 14 days before (${r.nAfter} and ${r.nBefore} entries).`,
        });
      } else notes.push({ label: f.title, info: r });
    }
    const checks = d.focusChecks.filter((c) => c.focusId === f.id && c.day > addDays(asOf, -14));
    if (checks.length > 0) {
      const done = checks.filter((c) => c.status === 'done').length;
      const part = checks.filter((c) => c.status === 'partial').length;
      const no = checks.filter((c) => c.status === 'not_done');
      const counts = new Map<string, number>();
      no.forEach((c) => c.obstacle && counts.set(c.obstacle, (counts.get(c.obstacle) ?? 0) + 1));
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      statements.push({
        id: `checks:${f.id}`,
        type: 'REPORTED',
        key: 'checks',
        section: 'focus',
        sourceRefs: checks.map((c) => c.id),
        text: `“${f.title}”: ${you ? 'you marked' : 'the patient marked'} done on ${done}, partly on ${part} and not done on ${no.length} of the last ${checks.length} check-ins${top ? `; most common obstacle: ${top[0]} (${top[1]})` : ''}.`,
      });
    }
  }

  // 2b) Goals (the person's own and agreed ones)
  for (const g of d.focusItems.filter((x) => x.kind === 'goal' && x.status === 'active')) {
    const pr = goalProgress(g);
    const target = g.reviewDay ? `; target date ${prettyDay(g.reviewDay)}` : '';
    statements.push({
      id: `goal:${g.id}`,
      type: 'REPORTED',
      key: 'goal',
      section: 'focus',
      sourceRefs: [g.id],
      text: pr.total > 0 ? `Goal “${g.title}”: ${pr.done} of ${pr.total} steps done${target}.` : `Goal “${g.title}”: no steps set yet${target}.`,
    });
  }

  // 2c) Questionnaire (GAD-7): the total and how it changed. No severity label, no interpretation.
  const g7 = gad7Change(d.assessments);
  if (g7) {
    const prev = g7.previous && g7.diff !== null ? ` Previous: ${g7.previous.total} on ${prettyDay(g7.previous.day)} (${g7.diff === 0 ? 'no change' : g7.diff > 0 ? `${g7.diff} higher` : `${Math.abs(g7.diff)} lower`}).` : '';
    statements.push({
      id: `gad7:${g7.latest.id}`,
      type: 'REPORTED',
      key: 'gad7',
      section: 'measures',
      sourceRefs: [g7.latest.id, ...(g7.previous ? [g7.previous.id] : [])],
      text: `${you ? 'You completed' : 'The patient completed'} the GAD-7 questionnaire on ${prettyDay(g7.latest.day)}: total ${g7.latest.total}.${prev} A screening questionnaire, not a diagnosis.`,
    });
  }

  // 3) Map: computed evidence per edge, from the viewer's scoped Moments only
  const nodeLabel = (id: string) => d.nodes.find((n) => n.id === id)?.label ?? id;
  for (const e of d.edges) {
    const ev = chainEdgeEvidence(d.moments, e.from, e.to);
    const shown = displayStatus(e, ev);
    if (ev.status !== 'none' && ev.firstDay) {
      const tr = chainTrend(d.moments, e.from, e.to, asOf);
      const trend = tr.status === 'ok' && tr.direction !== 'similar' ? ` In the last 4 weeks it appeared ${tr.direction === 'more' ? 'more' : 'less'} often than in the 4 weeks before.` : '';
      statements.push({
        id: `edge:${e.id}`,
        type: 'OBSERVED',
        key: 'chain_edge',
        section: 'map',
        sourceRefs: ev.momentIds,
        text: `${nodeLabel(e.from)} → ${nodeLabel(e.to)}: seen in ${ev.moments} Moments on ${ev.days} days since ${prettyDay(ev.firstDay)}${shown === 'emerging' ? ' (emerging)' : ''}.${trend}`,
      });
    } else if (e.status === 'clinician_hypothesis') {
      statements.push({
        id: `hyp:${e.id}`,
        type: 'TOPIC',
        key: 'hypothesis',
        section: 'topics',
        sourceRefs: [e.id],
        text: `Possible topic: whether "${nodeLabel(e.from)}" may be connected to "${nodeLabel(e.to)}" (a clinician hypothesis; no entries yet).`,
      });
    }
  }
  for (const pr of proposeEdges(d.moments, d.edges).slice(0, 2)) {
    statements.push({
      id: `proposed:${pr.from}>${pr.to}`,
      type: 'TOPIC',
      key: 'proposed_edge',
      section: 'topics',
      sourceRefs: d.moments.filter((m) => m.chain.includes(pr.from) && m.chain.includes(pr.to)).map((m) => m.id).slice(0, 20),
      text: `Possible topic: "${nodeLabel(pr.from)}" and "${nodeLabel(pr.to)}" appeared together on ${pr.days} days. Does this link fit?`,
    });
  }

  // 4) Things to bring
  for (const a of d.agenda.filter((x) => x.status === 'open')) {
    statements.push({ id: `agenda:${a.id}`, type: 'REPORTED', key: 'agenda', section: 'bring', sourceRefs: [a.id], text: a.text });
  }

  // 5) Coverage
  const dailies = d.signals.filter((s) => s.cadence === 'daily').length;
  const days = 14;
  const have = d.entries.filter((e) => e.day > addDays(asOf, -days) && d.signals.find((s) => s.id === e.signalId)?.cadence === 'daily').length;
  return { statements, coverage: { have, expected: dailies * days, days }, notes };
}
