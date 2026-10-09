import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getStore, addMoment, getPatient, addEntry, setConsent, listClinicianPatients } from '../lib/data/store.ts';
import { requireActor, requirePatientSelf, requireClinicianPatientAccess, AuthError } from '../lib/auth/demo.ts';
import { computeBrief } from '../lib/domain/insights/brief.ts';
import { todayLocal } from '../lib/domain/dates.ts';
import { polish } from '../lib/ai/polish.ts';
import { crisisScreen } from '../lib/domain/safety/crisis.ts';

test('auth: unauthenticated, wrong role and unlinked access are rejected; unlinked gives NOT_FOUND', () => {
  assert.throws(() => requireActor(undefined), (e: unknown) => e instanceof AuthError && e.code === 'UNAUTHENTICATED');
  assert.throws(() => requireActor('nobody'), AuthError);
  const clin = requireActor('c_lee');
  const alex = requireActor('p_alex');
  assert.throws(() => requirePatientSelf(clin), (e: unknown) => (e as AuthError).code === 'FORBIDDEN');
  assert.throws(() => requireClinicianPatientAccess(alex, 'p_alex'), (e: unknown) => (e as AuthError).code === 'FORBIDDEN');
  assert.throws(() => requireClinicianPatientAccess(clin, 'p_riley'), (e: unknown) => (e as AuthError).code === 'NOT_FOUND');
  assert.throws(() => requireClinicianPatientAccess(clin, 'does_not_exist'), (e: unknown) => (e as AuthError).code === 'NOT_FOUND');
  assert.equal(requireClinicianPatientAccess(clin, 'p_alex').patientId, 'p_alex');
  assert.deepEqual(listClinicianPatients('c_lee').map((p) => p.patientId).sort(), ['p_alex', 'p_jordan', 'p_sam']);
});

test('store: a patient only ever resolves to their own record', () => {
  assert.equal(requirePatientSelf(requireActor('p_sam')).patientId, 'p_sam');
});

test('moment capture builds Map nodes, shares nothing by default and stays invisible to the clinician when private', () => {
  const sam = getPatient('p_sam')!;
  const today = todayLocal();
  const before = sam.nodes.length;
  const m = addMoment(sam, { day: today, situation: 'Team meeting', thought: 'I sounded stupid', emotion: 'Embarrassed', intensity: 6, behavior: 'Stayed quiet', visibility: 'private', tools: [] });
  assert.equal(m.chain.length, 4);
  assert.equal(sam.nodes.length, before + 4);
  const clinView = computeBrief(sam, { role: 'clinician', clinicianId: 'c_lee', patientId: 'p_sam' }, today);
  assert.ok(!clinView.statements.some((s) => s.text.includes('Team meeting')));
});

test('consent change takes effect immediately', () => {
  const alex = getPatient('p_alex')!;
  const today = todayLocal();
  const withConsent = computeBrief(alex, { role: 'clinician', clinicianId: 'c_lee', patientId: 'p_alex' }, today).statements.length;
  setConsent(alex, 'share_checkins', false);
  setConsent(alex, 'share_map', false);
  const without = computeBrief(alex, { role: 'clinician', clinicianId: 'c_lee', patientId: 'p_alex' }, today).statements.length;
  assert.ok(without < withConsent);
  setConsent(alex, 'share_checkins', true);
  setConsent(alex, 'share_map', true);
});

test('entries upsert per signal per day', () => {
  const sam = getPatient('p_sam')!;
  const day = todayLocal();
  addEntry(sam, 'sleep', 6, day);
  addEntry(sam, 'sleep', 8, day);
  assert.equal(sam.entries.filter((e) => e.signalId === 'sleep' && e.day === day).length, 1);
  assert.equal(sam.entries.find((e) => e.signalId === 'sleep' && e.day === day)!.value, 8);
});

test('AI polish: not configured => typed error; unsafe or number-changing AI output is rejected; safe output accepted', async () => {
  const alex = getPatient('p_alex')!;
  const today = todayLocal();
  const stmts = computeBrief(alex, { role: 'patient', patientId: 'p_alex' }, today).statements;
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(() => polish(stmts), (e: unknown) => (e as { code?: string }).code === 'AI_NOT_CONFIGURED');

  process.env.GEMINI_API_KEY = 'test-key';
  const realFetch = globalThis.fetch;
  const target = stmts.find((s) => s.key === 'shift')!;
  const other = stmts.find((s) => s.key === 'pair')!;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    statements: [
                      { id: target.id, text: target.text.replace('has been', 'has been running') },
                      { id: other.id, text: 'Poor sleep causes anxiety, so you should sleep more.' },
                      { id: 'invented', text: 'Something invented.' },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
      { status: 200 },
    )) as typeof fetch;
  try {
    const r = await polish(stmts);
    assert.deepEqual(r.statements.map((s) => s.id), [target.id]);
    assert.ok(r.rejected.some((x) => x.startsWith(other.id)));
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.GEMINI_API_KEY;
  }
});

test('AI polish: provider safety block, rate limit and bad JSON are mapped to typed errors', async () => {
  const alex = getPatient('p_alex')!;
  const stmts = computeBrief(alex, { role: 'patient', patientId: 'p_alex' }, todayLocal()).statements;
  process.env.GEMINI_API_KEY = 'test-key';
  const realFetch = globalThis.fetch;
  const run = async (resp: Response) => {
    globalThis.fetch = (async () => resp) as typeof fetch;
    try {
      await polish(stmts);
      return 'no-error';
    } catch (e) {
      return (e as { code?: string }).code;
    }
  };
  try {
    assert.equal(await run(new Response('{}', { status: 429 })), 'AI_RATE_LIMITED');
    assert.equal(await run(new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), { status: 200 })), 'AI_BLOCKED');
    assert.equal(await run(new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not json' }] } }] }), { status: 200 })), 'AI_BAD_OUTPUT');
    assert.equal(await run(new Response('{}', { status: 500 })), 'AI_HTTP_ERROR');
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.GEMINI_API_KEY;
  }
});

test('the AI input never contains raw journal text, the injection string or private moment text', async () => {
  const alex = getPatient('p_alex')!;
  const stmts = computeBrief(alex, { role: 'patient', patientId: 'p_alex' }, todayLocal()).statements;
  process.env.GEMINI_API_KEY = 'test-key';
  const realFetch = globalThis.fetch;
  let sent = '';
  globalThis.fetch = (async (_u: unknown, init?: { body?: string }) => {
    sent = String(init?.body ?? '');
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ statements: [] }) }] } }] }), { status: 200 });
  }) as typeof fetch;
  try {
    await polish(stmts);
    assert.ok(sent.length > 0);
    assert.ok(!sent.includes('Ignore previous instructions'));
    assert.ok(!sent.includes('not ready to share'));
    assert.ok(!sent.includes('Dreading Monday'));
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.GEMINI_API_KEY;
  }
});

test('crisis screen is the same deterministic function used by the app', () => {
  assert.equal(crisisScreen('I do not want to be here anymore, I want to die'), true);
});
