import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAlex, buildJordan, CLINICIAN } from '../lib/data/seed.ts';
import { getPatient, completeOnboarding, addSignalTo, setSignalActive, addFocusTo, setNextSession, setAgendaStatus, addNodeTo, addEdgeTo, setTimezone, addEntry } from '../lib/data/store.ts';
import { todayIn, hourIn, isValidTimezone, isDayString, addDays, todayLocal } from '../lib/domain/dates.ts';
import { validateNewSignal, canResume, MAX_ACTIVE_SIGNALS, SIGNAL_SUGGESTIONS } from '../lib/domain/signals.ts';
import { validateNewFocus } from '../lib/domain/focus.ts';
import { validateNewNode, validateNewEdge } from '../lib/domain/map/edit.ts';
import { planToday } from '../lib/domain/today/scheduler.ts';
import { computeBrief } from '../lib/domain/insights/brief.ts';
import { scopeFor } from '../lib/domain/insights/scope.ts';
import type { Viewer } from '../lib/domain/types.ts';

const END = '2026-10-02';
const clin = (pid: string): Viewer => ({ role: 'clinician', clinicianId: CLINICIAN.id, patientId: pid });

test('time zones: local day and hour follow the person, not the server', () => {
  const t = new Date('2026-10-04T23:30:00Z');
  assert.equal(todayIn('UTC', t), '2026-10-04');
  assert.equal(todayIn('Africa/Tunis', t), '2026-10-05'); // UTC+1, no DST
  assert.equal(hourIn('Africa/Tunis', t), 0);
  assert.equal(todayIn('America/Los_Angeles', t), '2026-10-04');
  assert.equal(hourIn('America/Los_Angeles', t), 16);
  assert.equal(hourIn('UTC', new Date('2026-10-04T00:05:00Z')), 0);
  assert.equal(isValidTimezone('Europe/Paris'), true);
  assert.equal(isValidTimezone('Mars/Olympus'), false);
  assert.equal(isValidTimezone(''), false);
  assert.equal(isDayString('2026-02-30'), false);
  assert.equal(isDayString('2026-10-04'), true);
});

test('signals: validation, uniqueness, limit of 5 active, never shared by default, resume respects the limit', () => {
  const base = buildAlex(END).signals; // 3 active
  const ok1 = validateNewSignal(base, { label: 'Social time', kind: 'hours', unit: 'h', higherIsBetter: true, cadence: 'daily', window: 'evening' });
  assert.equal(ok1.ok, true);
  if (ok1.ok) {
    assert.equal(ok1.value.shared, false);
    assert.equal(ok1.value.active, true);
    assert.ok(ok1.value.id.startsWith('sig_'));
  }
  assert.equal(validateNewSignal(base, { label: 'sleep', kind: 'hours', higherIsBetter: true, cadence: 'daily', window: 'any' }).ok, false);
  assert.equal(validateNewSignal(base, { label: '', kind: 'hours', higherIsBetter: true, cadence: 'daily', window: 'any' }).ok, false);
  assert.equal(validateNewSignal(base, { label: 'x'.repeat(41), kind: 'hours', higherIsBetter: true, cadence: 'daily', window: 'any' }).ok, false);
  assert.equal(validateNewSignal(base, { label: 'Bad', kind: 'weird', higherIsBetter: true, cadence: 'daily', window: 'any' }).ok, false);
  let list = [...base];
  for (let i = 0; list.filter((s) => s.active).length < MAX_ACTIVE_SIGNALS; i++) {
    const r = validateNewSignal(list, { label: `Extra ${i}`, kind: 'count', higherIsBetter: true, cadence: 'daily', window: 'any' });
    assert.equal(r.ok, true);
    if (r.ok) list = [...list, r.value];
  }
  assert.equal(validateNewSignal(list, { label: 'One too many', kind: 'count', higherIsBetter: true, cadence: 'daily', window: 'any' }).ok, false);
  const paused = list.map((s, i) => (i === 0 ? { ...s, active: false } : s));
  assert.equal(canResume(list, list[0].id).ok, true); // already active: fine
  const r2 = validateNewSignal(paused, { label: 'Replacement', kind: 'count', higherIsBetter: true, cadence: 'daily', window: 'any' });
  assert.equal(r2.ok, true);
  if (r2.ok) assert.equal(canResume([...paused, r2.value], paused[0].id).ok, false);
});

test('scheduler never asks about a paused signal', () => {
  const alex = buildAlex(END);
  const paused = { ...alex, signals: alex.signals.map((s) => (s.id === 'sleep' ? { ...s, active: false } : s)) };
  assert.ok(!planToday(paused, END, 8).asks.some((a) => a.signalId === 'sleep'));
});

test('focus: a hypothesis must declare two different visible signals up front; experiments track exactly one', () => {
  const visible = buildAlex(END).signals;
  const base = { title: 'When I sleep less, my anxiety is higher', startDay: END, signalIds: [] as string[] };
  const h = validateNewFocus(visible, END, { ...base, kind: 'hypothesis', pair: { a: 'sleep', b: 'anxiety', aState: 'low', bState: 'high', lag: 0 } });
  assert.equal(h.ok, true);
  if (h.ok) assert.deepEqual(h.value.signalIds.sort(), ['anxiety', 'sleep']);
  assert.equal(validateNewFocus(visible, END, { ...base, kind: 'hypothesis' }).ok, false);
  assert.equal(validateNewFocus(visible, END, { ...base, kind: 'hypothesis', pair: { a: 'sleep', b: 'sleep', aState: 'low', bState: 'high', lag: 0 } }).ok, false);
  assert.equal(validateNewFocus(visible, END, { ...base, kind: 'hypothesis', pair: { a: 'sleep', b: 'anxiety', aState: 'low', bState: 'high', lag: 2 } }).ok, false);
  assert.equal(validateNewFocus(visible, END, { ...base, kind: 'hypothesis', pair: { a: 'sleep', b: 'secret', aState: 'low', bState: 'high', lag: 0 } }).ok, false);
  // signals the clinician cannot see (unshared) cannot be linked
  const onlySleep = visible.filter((s) => s.id === 'sleep');
  assert.equal(validateNewFocus(onlySleep, END, { ...base, kind: 'hypothesis', pair: { a: 'sleep', b: 'anxiety', aState: 'low', bState: 'high', lag: 0 } }).ok, false);
  assert.equal(validateNewFocus(visible, END, { ...base, kind: 'experiment', title: 'Wind-down', signalIds: ['sleep', 'anxiety'] }).ok, false);
  assert.equal(validateNewFocus(visible, END, { ...base, kind: 'experiment', title: 'Wind-down', signalIds: ['sleep'] }).ok, true);
  assert.equal(validateNewFocus(visible, END, { ...base, kind: 'goal', title: 'Walk more', signalIds: [] }).ok, true);
  assert.equal(validateNewFocus(visible, END, { ...base, kind: 'goal', title: '', signalIds: [] }).ok, false);
  assert.equal(validateNewFocus(visible, END, { ...base, kind: 'goal', startDay: addDays(END, 90), signalIds: [] }).ok, false);
  assert.equal(validateNewFocus(visible, END, { ...base, kind: 'goal', reviewDay: addDays(END, -3), signalIds: [] }).ok, false);
  assert.equal(validateNewFocus(visible, END, { ...base, kind: 'nonsense', signalIds: [] }).ok, false);
});

test('map editing: nodes and links are validated, deduplicated and bounded', () => {
  const nodes = buildAlex(END).nodes;
  const edges = buildAlex(END).edges;
  assert.equal(validateNewNode(nodes, 'Money worries', 'situation').ok, true);
  assert.equal(validateNewNode(nodes, 'conflict at work', 'situation').ok, false); // duplicate label
  assert.equal(validateNewNode(nodes, 'Thing', 'signal').ok, false); // signals/interventions are not hand-made
  assert.equal(validateNewNode(nodes, '', 'thought').ok, false);
  assert.equal(validateNewEdge(nodes, edges, 'n_conflict', 'n_failing', 'tends_to_follow').ok, false); // exists
  assert.equal(validateNewEdge(nodes, edges, 'n_conflict', 'n_conflict', 'appears_with').ok, false);
  assert.equal(validateNewEdge(nodes, edges, 'n_conflict', 'missing', 'appears_with').ok, false);
  assert.equal(validateNewEdge(nodes, edges, 'n_judge', 'n_leave', 'appears_with').ok, true);
  assert.equal(validateNewEdge(nodes, edges, 'n_judge', 'n_leave', 'causes').ok, false);
});

test('onboarding: new patient shares NOTHING until they choose; consents are exactly what they pick', () => {
  const jordan = getPatient('p_jordan')!;
  assert.equal(jordan.onboarded, false);
  const before = computeBrief(jordan, clin('p_jordan'), todayLocal());
  assert.ok(!before.statements.some((s) => s.key === 'shift' || s.key === 'agenda'));
  // the clinician's own seeded hypothesis is visible to them, the patient's data is not
  const scopedBefore = scopeFor(jordan, clin('p_jordan'));
  assert.equal(scopedBefore.moments.length, 0);
  assert.equal(scopedBefore.signals.length, 0);

  const r = completeOnboarding(jordan, ['sleep', 'anxiety', 'not_a_real_suggestion'], { share_focus: true }, 'Europe/Paris');
  assert.equal(r.ok, true);
  assert.equal(jordan.onboarded, true);
  assert.deepEqual(jordan.signals.map((s) => s.id).sort(), ['anxiety', 'sleep']);
  assert.ok(jordan.signals.every((s) => s.shared === false && s.active === true));
  assert.equal(jordan.consents.share_focus, true);
  assert.equal(jordan.consents.share_checkins, false);
  assert.equal(jordan.consents.allow_ai_analysis, false);
  assert.equal(jordan.timezone, 'Europe/Paris');
  // checks-ins exist but nothing is shared, so the clinician still sees no signal data
  addEntry(jordan, 'sleep', 6, todayLocal());
  assert.equal(scopeFor(jordan, clin('p_jordan')).entries.length, 0);
  assert.ok(SIGNAL_SUGGESTIONS.length >= 3);
});

test('store mutations: pause/resume, focus, next session drives modes, agenda done, map edits, time zone', () => {
  const alex = getPatient('p_alex')!;
  setSignalActive(alex, 'energy', false);
  assert.equal(alex.signals.find((s) => s.id === 'energy')!.active, false);
  setSignalActive(alex, 'energy', true);

  const v = validateNewFocus(alex.signals, todayLocal(), { kind: 'goal', title: 'Call a friend weekly', startDay: todayLocal(), signalIds: [] });
  assert.equal(v.ok, true);
  if (v.ok) assert.equal(addFocusTo(alex, v.value, 'clinician').createdBy, 'clinician');

  setNextSession(alex, addDays(todayLocal(), 1), todayLocal());
  assert.equal(alex.sessions.filter((s) => !s.occurred && s.day >= todayLocal()).length, 1);
  assert.equal(planToday(alex, todayLocal(), 9).mode, 'before_session');

  setAgendaStatus(alex, 'ag1', 'done');
  assert.equal(alex.agenda.find((a) => a.id === 'ag1')!.status, 'done');
  setAgendaStatus(alex, 'ag1', 'open');

  const n = validateNewNode(alex.nodes, 'Money worries', 'situation');
  assert.equal(n.ok, true);
  if (n.ok) {
    addNodeTo(alex, n.value);
    const e = validateNewEdge(alex.nodes, alex.edges, n.value.id, 'n_failing', 'tends_to_follow');
    assert.equal(e.ok, true);
    if (e.ok) addEdgeTo(alex, e.value, 'patient_belief');
  }
  // a patient-made belief edge is hidden from the clinician unless confirmed or supported by shared Moments
  const scoped = scopeFor(alex, clin('p_alex'));
  assert.ok(!scoped.edges.some((x) => x.from === 'n_money_worries'));

  assert.equal(setTimezone(alex, 'Mars/Olympus'), false);
  assert.equal(setTimezone(alex, 'Africa/Tunis'), true);
  assert.equal(alex.timezone, 'Africa/Tunis');
  setTimezone(alex, 'UTC');
});
