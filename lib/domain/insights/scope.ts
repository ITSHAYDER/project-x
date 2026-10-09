import type { MapEdge, PatientData, Viewer } from '../types.ts';
import { chainEdgeEvidence } from '../map/chains.ts';

/**
 * Viewer-scoped view of a person's data. A clinician-viewer computation may ONLY use what this
 * returns, so private Moments / journal entries / unshared signals can never influence anything
 * the clinician sees (not even aggregate counts).
 *
 * Map rule: the clinician sees an edge only if (a) a clinician authored/confirmed it, or (b) it is
 * supported by SHARED Moments, or (c) it links two shared signals. Patient-belief edges and engine
 * proposals that rest on private data stay hidden unless the patient sends them.
 */
export function scopeFor(data: PatientData, viewer: Viewer): PatientData {
  if (viewer.role === 'patient') return data;
  if (viewer.patientId !== data.patientId || data.linkedClinicianId !== viewer.clinicianId) {
    return emptyOf(data);
  }
  const c = data.consents;
  const signals = c.share_checkins ? data.signals.filter((s) => s.shared) : [];
  const sigIds = new Set(signals.map((s) => s.id));
  const moments = data.moments.filter((m) => m.visibility === 'shared');
  const nodeById = new Map(data.nodes.map((n) => [n.id, n]));

  const visibleEdge = (e: MapEdge): boolean => {
    if (e.status === 'dismissed') return false;
    if (e.status === 'clinician_hypothesis' || e.status === 'confirmed_together') return true;
    if (chainEdgeEvidence(moments, e.from, e.to).status !== 'none') return true;
    const a = nodeById.get(e.from);
    const b = nodeById.get(e.to);
    return !!(a && b && a.signalId && b.signalId && sigIds.has(a.signalId) && sigIds.has(b.signalId));
  };

  // Clinician-authored hypotheses are the clinician's own words, so they stay visible to them.
  const edges = c.share_map ? data.edges.filter(visibleEdge) : data.edges.filter((e) => e.status === 'clinician_hypothesis');
  const nodeIds = new Set<string>();
  edges.forEach((e) => {
    nodeIds.add(e.from);
    nodeIds.add(e.to);
  });
  if (c.share_map) moments.forEach((m) => m.chain.forEach((id) => nodeIds.add(id)));
  if (c.share_map) data.nodes.filter((n) => n.signalId && sigIds.has(n.signalId)).forEach((n) => nodeIds.add(n.id));
  const nodes = data.nodes.filter((n) => nodeIds.has(n.id));

  // Clinician-made items are always visible to that clinician. Patient-made ones need share_focus AND the item's own share flag.
  const focusItems = data.focusItems.filter((f) => f.createdBy === 'clinician' || (c.share_focus && f.shared === true));
  const focusIds = new Set(focusItems.map((f) => f.id));
  return {
    ...data,
    signals,
    entries: data.entries.filter((e) => sigIds.has(e.signalId)),
    moments,
    nodes,
    edges,
    focusItems,
    focusChecks: c.share_focus ? data.focusChecks.filter((f) => focusIds.has(f.focusId)) : [],
    tools: c.share_checkins ? data.tools : [],
    toolUses: c.share_checkins ? data.toolUses : [],
    agenda: data.agenda.filter((a) => a.shared),
    journal: data.journal.filter((j) => j.visibility === 'shared'),
    assessments: c.share_assessments ? data.assessments : [],
  };
}

function emptyOf(data: PatientData): PatientData {
  return {
    ...data,
    signals: [],
    entries: [],
    moments: [],
    nodes: [],
    edges: [],
    focusItems: [],
    focusChecks: [],
    tools: [],
    toolUses: [],
    sessions: [],
    agenda: [],
    journal: [],
    assessments: [],
  };
}
