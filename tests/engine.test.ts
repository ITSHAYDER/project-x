import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAlex, buildSam, buildRiley, CLINICIAN } from '../lib/data/seed.ts';
import { seriesOf } from '../lib/domain/insights/series.ts';
import { computeBaseline, detectShift } from '../lib/domain/insights/baseline.ts';
import { pairEvidence } from '../lib/domain/insights/pairs.ts';
import { computeBrief } from '../lib/domain/insights/brief.ts';
import { scopeFor } from '../lib/domain/insights/scope.ts';
import { chainEdgeEvidence } from '../lib/domain/map/chains.ts';
import { prePost } from '../lib/domain/map/interventions.ts';
import { earlySigns } from '../lib/domain/playbook/earlySigns.ts';
import { toolEvidence } from '../lib/domain/playbook/whatHelps.ts';
import { planToday } from '../lib/domain/today/scheduler.ts';
import { contextLine } from '../lib/domain/today/contextLine.ts';
import { verifyStatement, numbersIn } from '../lib/domain/ai/verifier.ts';
import { crisisScreen } from '../lib/domain/safety/crisis.ts';
import { addDays } from '../lib/domain/dates.ts';
import { median, quantile } from '../lib/domain/stats.ts';
import type { Viewer } from '../lib/domain/types.ts';

const END = '2026-10-02';
const alex = buildAlex(END);
const sam = buildSam(END);
const clinicianViewer = (pid: string): Viewer => ({ role: 'clinician', clinicianId: CLINICIAN.id, patientId: pid });
const patientViewer = (pid: string): Viewer => ({ role: 'patient', patientId: pid });

test('stats: median and quantile', () => {
  assert.equal(median([1, 3, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(quantile([1, 2, 3, 4, 5], 0.25), 2);
  assert.ok(Number.isNaN(median([])));
});

test('baseline: sufficient for Alex, insufficient (with readyOn) for Sam', () => {
  const b = computeBaseline(seriesOf(alex.entries, 'sleep'), END);
  assert.equal(b.status, 'ok');
  const sb = computeBaseline(seriesOf(sam.entries, 'sleep'), END);
  assert.equal(sb.status, 'insufficient');
  if (sb.status === 'insufficient') assert.ok(sb.readyOn && sb.readyOn > END);
});

test('shift: finds the planted recent sleep drop, not a spurious energy shift', () => {
  const sleep = alex.signals.find((s) => s.id === 'sleep')!;
  const energy = alex.signals.find((s) => s.id === 'energy')!;
  const s = detectShift(sleep, seriesOf(alex.entries, 'sleep'), END);
  assert.ok(s && s.direction === 'lower' && s.current < s.usual);
  assert.equal(detectShift(energy, seriesOf(alex.entries, 'energy'), END), null);
});

test('pair evidence: planted sleep(low) -> anxiety(high) is present; reversed noise is not', () => {
  const from = addDays(END, -83);
  const ev = pairEvidence(seriesOf(alex.entries, 'sleep'), seriesOf(alex.entries, 'anxiety'), 'low', 'high', 0, from, END);
  assert.equal(ev.status, 'ok');
  if (ev.status === 'ok') {
    assert.equal(ev.verdict, 'present');
    assert.ok(ev.rateWhenA > ev.rateWhenOther + 0.3);
  }
  const none = pairEvidence(seriesOf(alex.entries, 'energy'), seriesOf(alex.entries, 'sleep'), 'high', 'high', 0, from, END);
  if (none.status === 'ok') assert.notEqual(none.verdict, 'present');
});

test('pair evidence: insufficient with few pairs', () => {
  const ev = pairEvidence(seriesOf(sam.entries, 'sleep'), seriesOf(sam.entries, 'anxiety'), 'low', 'high', 0, addDays(END, -83), END);
  assert.equal(ev.status, 'insufficient');
});

test('chain edge evidence: observed for the main chain, none for a reversed edge', () => {
  const ev = chainEdgeEvidence(alex.moments, 'n_conflict', 'n_failing');
  assert.equal(ev.status, 'observed');
  assert.equal(chainEdgeEvidence(alex.moments, 'n_failing', 'n_conflict').status, 'none');
});

test('pre/post: planted wind-down improvement is detected and described, not claimed as cause', () => {
  const r = prePost(seriesOf(alex.entries, 'sleep'), addDays(END, -35), END);
  assert.equal(r.status, 'ok');
  if (r.status === 'ok') assert.ok(r.diff > 0);
});

test('early signs: sleep drop precedes harder energy periods in 3 of 4 (retrospective)', () => {
  const energy = alex.signals.find((s) => s.id === 'energy')!;
  const others = alex.signals.map((s) => ({ signal: s, series: seriesOf(alex.entries, s.id) }));
  const r = earlySigns(energy, seriesOf(alex.entries, 'energy'), others, END);
  assert.equal(r.status, 'ok');
  if (r.status === 'ok') {
    const sleepSign = r.signs.find((x) => x.signalId === 'sleep' && x.direction === 'lower');
    assert.ok(sleepSign);
    assert.equal(sleepSign!.periodsShifted, 3);
    assert.equal(sleepSign!.periodsEvaluated, 4);
  }
});

test('early signs: insufficient for Sam', () => {
  const s = sam.signals[0];
  const r = earlySigns(s, seriesOf(sam.entries, s.id), [], END);
  assert.equal(r.status, 'insufficient');
});

test('what helps: walk is better-more-often; breathing is not claimed as helpful', () => {
  const sig = alex.signals.find((s) => s.id === 'anxiety')!;
  const out = seriesOf(alex.entries, 'anxiety');
  const walk = toolEvidence(alex.toolUses.filter((u) => u.toolId === 'walk'), out, sig);
  assert.equal(walk.status, 'ok');
  if (walk.status === 'ok') assert.equal(walk.verdict, 'more_often_better');
  const br = toolEvidence(alex.toolUses.filter((u) => u.toolId === 'breathing'), out, sig);
  if (br.status === 'ok') assert.notEqual(br.verdict, 'more_often_better');
});

test('privacy: clinician-scoped brief never uses private Moments, unshared entries or private agenda/journal', () => {
  const clin = scopeFor(alex, clinicianViewer('p_alex'));
  assert.ok(clin.moments.every((m) => m.visibility === 'shared'));
  assert.ok(clin.journal.every((j) => j.visibility === 'shared'));
  assert.ok(clin.agenda.every((a) => a.shared));
  const b = computeBrief(alex, clinicianViewer('p_alex'), END);
  assert.ok(!b.statements.some((s) => s.text.includes('not ready to share')));
  const pb = computeBrief(alex, patientViewer('p_alex'), END);
  assert.ok(pb.statements.some((s) => s.text.includes('not ready to share')));
});

test('privacy mutation: adding a PRIVATE moment never changes what the clinician sees', () => {
  const before = JSON.stringify(computeBrief(alex, clinicianViewer('p_alex'), END));
  const mutated = {
    ...alex,
    moments: [...alex.moments, { id: 'x1', day: END, visibility: 'private' as const, situation: '', thought: '', emotion: '', intensity: 5, behavior: '', chain: ['n_conflict', 'n_failing', 'n_shame'], tools: [] }],
  };
  assert.equal(JSON.stringify(computeBrief(mutated, clinicianViewer('p_alex'), END)), before);
});

test('privacy: revoking checkin consent removes all signal-derived statements for the clinician', () => {
  const revoked = { ...alex, consents: { ...alex.consents, share_checkins: false } };
  const b = computeBrief(revoked, clinicianViewer('p_alex'), END);
  assert.ok(!b.statements.some((s) => ['shift', 'compare', 'stable', 'pair', 'prepost'].includes(s.key)));
});

test('privacy: an unlinked clinician sees nothing', () => {
  const b = computeBrief(alex, { role: 'clinician', clinicianId: 'c_other', patientId: 'p_alex' }, END);
  assert.equal(b.statements.length, 0);
  const riley = buildRiley(END);
  const r = computeBrief(riley, { role: 'clinician', clinicianId: CLINICIAN.id, patientId: 'p_riley' }, END);
  assert.equal(r.statements.length, 0);
});

test('privacy: patient-belief edges resting on private data are hidden from the clinician', () => {
  const clin = scopeFor(alex, clinicianViewer('p_alex'));
  assert.ok(!clin.edges.some((e) => e.id === 'e7'));
});

test('brief: patient voice uses "your", clinician voice uses "the patient\'s"; statement types are labelled', () => {
  const p = computeBrief(alex, patientViewer('p_alex'), END);
  const c = computeBrief(alex, clinicianViewer('p_alex'), END);
  assert.ok(p.statements.some((s) => s.text.startsWith('Your ')));
  assert.ok(c.statements.some((s) => s.text.startsWith("The patient's ")));
  assert.ok(p.statements.every((s) => ['REPORTED', 'OBSERVED', 'TOPIC'].includes(s.type)));
  assert.ok(p.statements.every((s) => s.sourceRefs.length > 0));
  assert.ok(!p.statements.filter((s) => s.key !== 'agenda').some((s) => /\b(causes|caused|because|diagnos)/i.test(s.text.replace(/not a cause/gi, '').replace(/not a diagnosis/gi, ''))));
});

test('brief: Sam (day zero) yields honest insufficient notes, no invented statements about signals', () => {
  const b = computeBrief(sam, patientViewer('p_sam'), END);
  assert.ok(!b.statements.some((s) => s.key === 'shift'));
  assert.ok(b.notes.length > 0);
});

test('scheduler: caps asks, respects window, quiet mode, session modes', () => {
  const morning = planToday(alex, END, 8);
  assert.ok(morning.asks.length <= 3);
  assert.ok(morning.asks.every((a) => ['sleep'].includes(a.signalId)));
  const evening = planToday(alex, END, 19);
  assert.ok(evening.asks.every((a) => ['anxiety', 'energy'].includes(a.signalId)));
  assert.equal(planToday(alex, END, 8, { maxAsks: 3, quiet: true, morningUntilHour: 12 }).asks.length, 0);
  assert.equal(planToday(alex, END, 8).mode, 'before_session');
  assert.equal(planToday(alex, addDays(END, -4), 8).mode, 'after_session');
  assert.equal(planToday(sam, END, 8).asks[0]?.signalId, 'sleep');
});

test('scheduler: does not re-ask a signal already answered today', () => {
  const withToday = { ...alex, entries: [...alex.entries, { id: 'z', signalId: 'sleep', day: END, value: 7 }] };
  assert.ok(!planToday(withToday, END, 8).asks.some((a) => a.signalId === 'sleep'));
});

test('context line: priority order and no LLM', () => {
  const plan = planToday(alex, END, 8);
  const changes = computeBrief(alex, patientViewer('p_alex'), END).statements;
  assert.equal(contextLine(alex, plan, END, changes).kind, 'before_session');
  const plan2 = planToday(alex, addDays(END, -10), 8);
  assert.notEqual(contextLine(alex, plan2, addDays(END, -10), changes).kind, 'before_session');
});

test('verifier: rejects invented sources, unsupported numbers, diagnoses, causal/directive/medication language', () => {
  const ctx = { allowedSourceRefs: new Set(['a1']), allowedNumbers: new Set(['5', '7']) };
  const ok = verifyStatement({ type: 'OBSERVED', text: 'Sleep was lower on 5 of 7 days.', sourceRefs: ['a1'] }, ctx);
  assert.equal(ok.ok, true);
  const bad = (text: string, refs = ['a1'], type: 'OBSERVED' | 'TOPIC' = 'OBSERVED') => verifyStatement({ type, text, sourceRefs: refs }, ctx).failures;
  assert.ok(bad('Sleep was lower on 6 of 7 days.').includes('unsupported_number:6'));
  assert.ok(bad('Sleep was lower.', ['zzz']).some((f) => f.startsWith('unknown_source_ref')));
  assert.ok(bad('Sleep was lower.', []).includes('missing_source_refs'));
  assert.ok(bad('This looks like depression.').includes('diagnostic_language'));
  assert.ok(bad('Poor sleep causes anxiety.').includes('causal_language'));
  assert.ok(bad('You should talk to someone.').includes('directive_language'));
  assert.ok(bad('Consider your dose.').includes('medication_language'));
  assert.ok(bad('You will relapse soon.').includes('prediction_language'));
  assert.ok(bad('This clearly proves it.').includes('certainty_language'));
  assert.ok(bad('Sleep is the issue.', ['a1'], 'TOPIC').includes('topic_not_phrased_as_possibility'));
  assert.deepEqual(numbersIn('7.0 and 05 days'), ['7', '5']);
});

test('crisis screen: deterministic detection and no false positive on ordinary text', () => {
  assert.equal(crisisScreen('I want to die'), true);
  assert.equal(crisisScreen('thinking about suicide'), true);
  assert.equal(crisisScreen('I want to hurt myself'), true);
  assert.equal(crisisScreen('The meeting killed my mood but I am fine'), false);
  assert.equal(crisisScreen(''), false);
});

import { edgeSummaries } from '../lib/domain/map/summaries.ts';
import { playbook } from '../lib/domain/playbook/summary.ts';
import { evidenceLines } from '../lib/domain/insights/evidence.ts';

test('map summaries: observed chain, observed pair, intervention pre/post, belief stays belief; no causal words', () => {
  const sums = edgeSummaries(alex, END);
  const byId = (id: string) => sums.find((s) => s.edge.id === id)!;
  assert.equal(byId('e1').shown, 'observed');
  assert.equal(byId('e5').shown, 'confirmed_together');
  assert.ok(byId('e5').text.includes('pattern in the reported data'));
  assert.equal(byId('e6').shown, 'confirmed_together');
  assert.ok(byId('e6').text.startsWith('Since '));
  assert.equal(byId('e4').shown, 'clinician_hypothesis');
  assert.ok(byId('e4').text.includes('not something seen in the data'));
  assert.ok(!sums.some((s) => /\b(causes|caused|because)\b/i.test(s.text)));
  const walk = byId('e7');
  assert.ok(walk.text.includes('days with it'));
});

test('map summaries: a clinician-scoped view omits private-only edges and never exposes private moment evidence', () => {
  const scoped = scopeFor(alex, clinicianViewer('p_alex'));
  const sums = edgeSummaries(scoped, END);
  assert.ok(!sums.some((s) => s.edge.id === 'e7'));
  const privateIds = new Set(alex.moments.filter((m) => m.visibility === 'private').map((m) => m.id));
  assert.ok(!sums.some((s) => s.sourceRefs.some((r) => privateIds.has(r))));
});

test('playbook: early sign and what-helps text are retrospective, non-causal, and gated by consent for clinicians', () => {
  const pb = playbook(alex, patientViewer('p_alex'), END);
  assert.ok(pb.early && pb.early.lines.length >= 1);
  assert.ok(pb.early!.lines[0].text.includes('not a prediction'));
  assert.ok(pb.helps.find((h) => h.toolId === 'walk')!.text.includes('Better more often'));
  const noEarly = playbook({ ...alex, consents: { ...alex.consents, share_early_signs: false } }, clinicianViewer('p_alex'), END);
  assert.equal(noEarly.early, null);
  const sam1 = playbook(sam, patientViewer('p_sam'), END);
  assert.equal(sam1.early!.result.status, 'insufficient');
});

test('evidence lines only resolve ids present in the (scoped) data', () => {
  const scoped = scopeFor(alex, clinicianViewer('p_alex'));
  const priv = alex.moments.find((m) => m.visibility === 'private')!;
  assert.deepEqual(evidenceLines(scoped, [priv.id]), []);
  const shared = alex.moments.find((m) => m.visibility === 'shared')!;
  assert.equal(evidenceLines(scoped, [shared.id]).length, 1);
});
