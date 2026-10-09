import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAlex, buildSam, CLINICIAN } from '../lib/data/seed.ts';
import { validateNewGoal, validateNewStep, goalProgress, MAX_ACTIVE_GOALS, MAX_STEPS } from '../lib/domain/goals.ts';
import { scoreGad7, newGad7, gad7Change, GAD7_ITEMS, GAD7_OPTIONS } from '../lib/domain/gad7.ts';
import { anxietyContext } from '../lib/domain/playbook/anxietyContext.ts';
import { computeBrief } from '../lib/domain/insights/brief.ts';
import { scopeFor } from '../lib/domain/insights/scope.ts';
import { evidenceLines } from '../lib/domain/insights/evidence.ts';
import { addDays } from '../lib/domain/dates.ts';
import type { Viewer } from '../lib/domain/types.ts';

const END = '2026-10-02';
const alex = buildAlex(END);
const clin: Viewer = { role: 'clinician', clinicianId: CLINICIAN.id, patientId: 'p_alex' };
const pat: Viewer = { role: 'patient', patientId: 'p_alex' };

test('goals: validation, limits, target date rules, steps get stable ids, new goals default to the chosen sharing', () => {
  const ok1 = validateNewGoal([], END, { title: 'Call a friend weekly', why: 'I miss them', targetDay: addDays(END, 30), steps: ['Pick a day', '', 'Put it in the calendar'], shared: false });
  assert.equal(ok1.ok, true);
  if (ok1.ok) {
    assert.equal(ok1.value.kind, 'goal');
    assert.equal(ok1.value.steps!.length, 2);
    assert.deepEqual(ok1.value.steps!.map((s) => s.id), ['gs1', 'gs2']);
    assert.equal(ok1.value.shared, false);
  }
  assert.equal(validateNewGoal([], END, { title: '', steps: [], shared: false }).ok, false);
  assert.equal(validateNewGoal([], END, { title: 'x'.repeat(121), steps: [], shared: false }).ok, false);
  assert.equal(validateNewGoal([], END, { title: 'Goal', targetDay: addDays(END, -1), steps: [], shared: false }).ok, false);
  assert.equal(validateNewGoal([], END, { title: 'Goal', targetDay: '2026-13-01', steps: [], shared: false }).ok, false);
  assert.equal(validateNewGoal([], END, { title: 'Goal', steps: Array.from({ length: MAX_STEPS + 1 }, (_, i) => `s${i}`), shared: false }).ok, false);
  assert.equal(validateNewGoal(alex.focusItems, END, { title: 'reply to my manager within a day', steps: [], shared: false }).ok, false); // duplicate (case-insensitive)
  let items = [...alex.focusItems.filter((f) => f.kind !== 'goal')];
  for (let i = 0; i < MAX_ACTIVE_GOALS; i++) {
    const r = validateNewGoal(items, END, { title: `Goal ${i}`, steps: [], shared: false });
    assert.equal(r.ok, true);
    if (r.ok) items = [...items, { ...r.value, id: `x${i}`, createdBy: 'patient', status: 'active' }];
  }
  assert.equal(validateNewGoal(items, END, { title: 'One more', steps: [], shared: false }).ok, false);
});

test('goals: progress and steps', () => {
  const g = alex.focusItems.find((f) => f.id === 'g_reply')!;
  assert.deepEqual(goalProgress(g), { done: 2, total: 4, pct: 50 });
  assert.deepEqual(goalProgress({ ...g, steps: [] }), { done: 0, total: 0, pct: 0 });
  const s = validateNewStep(g, 'Celebrate');
  assert.equal(s.ok, true);
  if (s.ok) assert.equal(s.value.id, 'gs5');
  assert.equal(validateNewStep(g, '   ').ok, false);
  assert.equal(validateNewStep({ ...g, steps: Array.from({ length: MAX_STEPS }, (_, i) => ({ id: `gs${i + 1}`, text: 't', done: false })) }, 'one more').ok, false);
});

test('goals privacy: clinician sees clinician-made goals and patient goals only when shared AND share_focus is on', () => {
  const v = scopeFor(alex, clin);
  assert.ok(v.focusItems.some((f) => f.id === 'g_reply'));
  assert.ok(!v.focusItems.some((f) => f.id === 'g_priv'), 'private goal must never reach the clinician');
  const off = scopeFor({ ...alex, consents: { ...alex.consents, share_focus: false } }, clin);
  assert.ok(!off.focusItems.some((f) => f.id === 'g_reply'));
  assert.ok(off.focusItems.some((f) => f.id === 'f_wind'), 'clinician-authored items stay visible to their author');
  const brief = computeBrief(alex, clin, END);
  assert.ok(brief.statements.some((s) => s.key === 'goal' && s.text.includes('Reply to my manager')));
  assert.ok(!brief.statements.some((s) => s.text.includes('swimming')));
  const own = computeBrief(alex, pat, END);
  assert.ok(own.statements.some((s) => s.text.includes('swimming')));
  assert.ok(own.statements.find((s) => s.id === 'goal:g_reply')!.text.includes('2 of 4 steps done'));
});

test('privacy mutation: adding a PRIVATE goal never changes what the clinician sees', () => {
  const before = JSON.stringify(computeBrief(alex, clin, END));
  const mutated = { ...alex, focusItems: [...alex.focusItems, { id: 'zz', kind: 'goal' as const, title: 'Secret goal', startDay: END, signalIds: [], createdBy: 'patient' as const, status: 'active' as const, shared: false, steps: [] }] };
  assert.equal(JSON.stringify(computeBrief(mutated, clin, END)), before);
});

test('GAD-7: scoring, validation, change vs previous, no severity label anywhere', () => {
  assert.equal(GAD7_ITEMS.length, 7);
  assert.equal(GAD7_OPTIONS.length, 4);
  const s = scoreGad7([0, 1, 2, 3, 0, 1, 2]);
  assert.equal(s.ok && s.value, 9);
  assert.equal(scoreGad7([0, 1, 2]).ok, false);
  assert.equal(scoreGad7([0, 1, 2, 3, 4, 0, 0]).ok, false);
  assert.equal(scoreGad7([0, 1, 2, 3, 0.5, 0, 0]).ok, false);
  const a = newGad7([1, 1, 1, 1, 1, 1, 1], END, 'n1');
  assert.equal(a.ok && a.value.total, 7);
  const ch = gad7Change(alex.assessments)!;
  assert.equal(ch.latest.id, 'g4');
  assert.equal(ch.previous!.id, 'g3');
  assert.equal(ch.diff, 1);
  assert.equal(gad7Change([]), null);
  const brief = computeBrief(alex, clin, END);
  const st = brief.statements.find((x) => x.key === 'gad7')!;
  assert.ok(st.text.includes('total 10') && st.text.includes('not a diagnosis'));
  assert.ok(!/\b(mild|moderate|severe|disorder|anxiety disorder)\b/i.test(st.text));
  assert.equal(st.section, 'measures');
  // consent: questionnaire is invisible to the clinician unless the patient shares assessments
  const off = computeBrief({ ...alex, consents: { ...alex.consents, share_assessments: false } }, clin, END);
  assert.ok(!off.statements.some((x) => x.key === 'gad7'));
  assert.equal(evidenceLines(scopeFor(alex, clin), ['g4']).length, 1);
  assert.deepEqual(evidenceLines(scopeFor({ ...alex, consents: { ...alex.consents, share_assessments: false } }, clin), ['g4']), []);
});

test('anxiety context: descriptive counts only, honest insufficient states', () => {
  const sam = buildSam(END);
  const r0 = anxietyContext(sam, END);
  assert.equal(r0.status, 'insufficient');
  const r = anxietyContext(alex, END);
  assert.ok(r.status === 'ok' || r.status === 'insufficient');
  if (r.status === 'ok') {
    assert.ok(r.situations.length <= 3);
    for (const s of r.situations) {
      assert.ok(s.onHigher <= s.higherDays && s.onOther <= s.otherDays);
      assert.ok(s.onHigher >= 2);
    }
  }
});
