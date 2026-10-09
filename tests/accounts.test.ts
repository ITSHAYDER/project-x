import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'px-'));
process.env.PX_DATA_FILE = join(dir, 'db.json');
process.env.CLINICIAN_SIGNUP_CODE = 'pilot-secret-123';

const store = await import('../lib/data/store.ts');
const svc = await import('../lib/auth/service.ts');
const pw = await import('../lib/auth/password.ts');
const auth = await import('../lib/auth/demo.ts');
const { computeBrief } = await import('../lib/domain/insights/brief.ts');
const { scopeFor } = await import('../lib/domain/insights/scope.ts');

let ipn = 0;
const signUp = (i: Parameters<typeof svc.signUp>[0], now?: number) => svc.signUp({ ip: `10.0.${Math.floor(ipn / 200)}.${ipn++ % 200}`, ...i }, now);
const GOOD = 'a-long-passphrase-42';
const T0 = 1_800_000_000_000;

function mkClinician(email = 'doc@example.org') {
  const r = signUp({ name: 'Dr Rivera', email, password: GOOD, role: 'clinician', clinicianCode: 'pilot-secret-123' }, T0);
  assert.equal(r.ok, true);
  return r.ok ? r.value.accountId : '';
}

before(() => store._resetStoreForTests());

test('passwords: hashed with scrypt, verify works, wrong/garbage rejected, policy enforced', () => {
  const h = pw.hashPassword(GOOD);
  assert.ok(h.startsWith('scrypt$') && !h.includes(GOOD));
  assert.equal(pw.verifyPassword(GOOD, h), true);
  assert.equal(pw.verifyPassword('wrong-password-42', h), false);
  assert.equal(pw.verifyPassword(GOOD, 'garbage'), false);
  assert.equal(pw.hashPassword(GOOD) === h, false, 'salted');
  assert.equal(pw.validatePassword('short', 'a@b.co', 'A').ok, false);
  assert.equal(pw.validatePassword('password123', 'a@b.co', 'A').ok, false);
  assert.equal(pw.validatePassword('aaaaaaaaaaaa', 'a@b.co', 'A').ok, false);
  assert.equal(pw.validatePassword('alexander-the-great-1', 'alexander@x.org', 'Zed').ok, false);
  assert.equal(pw.validatePassword(GOOD, 'a@b.co', 'Sam').ok, true);
  assert.equal(pw.validateEmail('Not An Email').ok, false);
  const e = pw.validateEmail('  Mixed@Case.ORG ');
  assert.equal(e.ok && e.value, 'mixed@case.org');
});

test('sign up: patient account + empty private record; duplicates and bad input rejected', () => {
  const r = signUp({ name: 'Taylor', email: 'taylor@example.org', password: GOOD, role: 'patient', timezone: 'Africa/Tunis' }, T0);
  assert.equal(r.ok, true);
  const id = r.ok ? r.value.accountId : '';
  const p = store.getPatient(id)!;
  assert.equal(p.onboarded, false);
  assert.equal(p.timezone, 'Africa/Tunis');
  assert.equal(p.linkedClinicianId, null);
  assert.ok(Object.values(p.consents).every((v) => v === false), 'nothing is shared by default');
  assert.equal(signUp({ name: 'Taylor 2', email: 'TAYLOR@example.org', password: GOOD, role: 'patient' }, T0).ok, false);
  assert.equal(signUp({ name: '', email: 'x@example.org', password: GOOD, role: 'patient' }, T0).ok, false);
  assert.equal(signUp({ name: 'X', email: 'x@example.org', password: 'short', role: 'patient' }, T0).ok, false);
  assert.equal(signUp({ name: 'X', email: 'x@example.org', password: GOOD, role: 'admin' }, T0).ok, false);
  const stored = store.getStore().accounts.find((a) => a.id === id)!;
  assert.ok(!JSON.stringify(stored).includes(GOOD));
});

test('sign up: clinician needs the access code; unset code disables clinician sign-up', () => {
  assert.equal(signUp({ name: 'D', email: 'd1@example.org', password: GOOD, role: 'clinician' }, T0).ok, false);
  assert.equal(signUp({ name: 'D', email: 'd1@example.org', password: GOOD, role: 'clinician', clinicianCode: 'wrong' }, T0).ok, false);
  assert.equal(signUp({ name: 'D', email: 'd1@example.org', password: GOOD, role: 'clinician', clinicianCode: 'pilot-secret-123' }, T0).ok, true);
  const saved = process.env.CLINICIAN_SIGNUP_CODE;
  delete process.env.CLINICIAN_SIGNUP_CODE;
  assert.equal(signUp({ name: 'D', email: 'd2@example.org', password: GOOD, role: 'clinician', clinicianCode: 'pilot-secret-123' }, T0).ok, false);
  process.env.CLINICIAN_SIGNUP_CODE = saved;
});

test('login: success creates a session that resolves; wrong password and unknown email give the same message', () => {
  const ok1 = svc.logIn('taylor@example.org', GOOD, '1.1.1.1', T0);
  assert.equal(ok1.ok, true);
  const token = ok1.ok ? ok1.value.token : '';
  assert.equal(token.length, 64);
  const actor = svc.resolveSession(token, T0 + 1000)!;
  assert.equal(actor.role, 'patient');
  assert.equal(actor.name, 'Taylor');
  assert.ok(!JSON.stringify(store.getStore().sessions).includes(token), 'only a hash of the token is stored');
  const bad1 = svc.logIn('taylor@example.org', 'wrong-password-99', '2.2.2.2', T0);
  const bad2 = svc.logIn('nobody@example.org', 'wrong-password-99', '3.3.3.3', T0);
  assert.equal(bad1.ok, false);
  assert.equal(bad2.ok, false);
  assert.equal(!bad1.ok && bad1.error, !bad2.ok && bad2.error);
});

test('sessions: expire, can be logged out, garbage tokens resolve to nothing', () => {
  const r = svc.logIn('taylor@example.org', GOOD, '4.4.4.4', T0);
  const token = r.ok ? r.value.token : '';
  assert.ok(svc.resolveSession(token, T0 + svc.SESSION_TTL - 1));
  assert.equal(svc.resolveSession(token, T0 + svc.SESSION_TTL + 1), null);
  assert.equal(svc.resolveSession('x'.repeat(64), T0), null);
  assert.equal(svc.resolveSession(undefined, T0), null);
  assert.equal(svc.resolveSession('short', T0), null);
  svc.logOut(token);
  assert.equal(svc.resolveSession(token, T0 + 5), null);
});

test('login lockout after repeated failures, even with the right password, then recovers', () => {
  signUp({ name: 'Lock', email: 'lock@example.org', password: GOOD, role: 'patient' }, T0);
  for (let i = 0; i < svc.MAX_FAILED; i++) assert.equal(svc.logIn('lock@example.org', 'nope-nope-nope-1', `9.9.9.${i}`, T0 + i).ok, false);
  const locked = svc.logIn('lock@example.org', GOOD, '9.9.9.99', T0 + 10);
  assert.equal(locked.ok, false);
  assert.ok(!locked.ok && /Too many/.test(locked.error));
  assert.equal(svc.logIn('lock@example.org', GOOD, '9.9.9.98', T0 + svc.LOCK_WINDOW + 100).ok, true);
});

test('invites: single use, expire, hashed at rest, only for the right clinician; patient joins private', () => {
  const clin = mkClinician('inviter@example.org');
  const inv = svc.createInvite(clin, T0);
  assert.equal(inv.ok, true);
  const code = inv.ok ? inv.value.code : '';
  assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.ok(!JSON.stringify(store.getStore().invites).includes(code.replace('-', '')), 'code is hashed at rest');

  const s1 = signUp({ name: 'Pat One', email: 'pat1@example.org', password: GOOD, role: 'patient', inviteCode: code.toLowerCase().replace('-', ' ') }, T0);
  assert.equal(s1.ok && s1.value.linked, true);
  const p1 = store.getPatient(s1.ok ? s1.value.accountId : '')!;
  assert.equal(p1.linkedClinicianId, clin);
  assert.ok(Object.values(p1.consents).every((v) => v === false));
  // reuse fails
  assert.equal(signUp({ name: 'Pat Two', email: 'pat2@example.org', password: GOOD, role: 'patient', inviteCode: code }, T0).ok, false);
  // bad code at sign-up does not create an account
  assert.equal(signUp({ name: 'Pat Three', email: 'pat3@example.org', password: GOOD, role: 'patient', inviteCode: 'ZZZZ-ZZZZ' }, T0).ok, false);
  assert.equal(store.getStore().accounts.some((a) => a.email === 'pat3@example.org'), false);
  // expiry
  const inv2 = svc.createInvite(clin, T0);
  const code2 = inv2.ok ? inv2.value.code : '';
  const late = signUp({ name: 'Late', email: 'late@example.org', password: GOOD, role: 'patient', inviteCode: code2 }, T0 + svc.INVITE_TTL + 1);
  assert.equal(late.ok, false);
  // patients cannot create invites
  assert.equal(svc.createInvite(s1.ok ? s1.value.accountId : '', T0).ok, false);
});

test('connect later from settings, and disconnect keeps the patient record', () => {
  const clin = mkClinician('c2@example.org');
  const solo = signUp({ name: 'Solo', email: 'solo@example.org', password: GOOD, role: 'patient' }, T0);
  const pid = solo.ok ? solo.value.accountId : '';
  const inv = svc.createInvite(clin, T0);
  const code = inv.ok ? inv.value.code : '';
  assert.equal(svc.redeemInvite(pid, 'AAAA-BBBB', T0).ok, false);
  assert.equal(svc.redeemInvite(pid, code, T0).ok, true);
  assert.equal(svc.redeemInvite(pid, code, T0).ok, false, 'already connected');
  const p = store.getPatient(pid)!;
  store.addEntry(p, 'mood', 6, '2026-10-01');
  assert.equal(svc.unlinkClinician(pid).ok, true);
  assert.equal(store.getPatient(pid)!.linkedClinicianId, null);
  assert.equal(store.getPatient(pid)!.entries.length, 1, 'record stays with the patient');
});

test('authorization: a clinician sees only linked patients, and only what is shared', () => {
  const c1 = mkClinician('auth1@example.org');
  const c2 = mkClinician('auth2@example.org');
  const code = (svc.createInvite(c1, T0) as { ok: true; value: { code: string } }).value.code;
  const s = signUp({ name: 'Linked', email: 'linked@example.org', password: GOOD, role: 'patient', inviteCode: code }, T0);
  const pid = s.ok ? s.value.accountId : '';
  const actor1 = { id: c1, role: 'clinician' as const, name: 'C1' };
  const actor2 = { id: c2, role: 'clinician' as const, name: 'C2' };
  assert.equal(auth.requireClinicianPatientAccess(actor1, pid).patientId, pid);
  assert.throws(() => auth.requireClinicianPatientAccess(actor2, pid), (e: unknown) => (e as { code?: string }).code === 'NOT_FOUND');
  const p = store.getPatient(pid)!;
  p.journal.push({ id: 'j', day: '2026-10-01', text: 'private thought', visibility: 'private' });
  p.signals.push({ id: 'mood', label: 'Mood', kind: 'scale_0_10', higherIsBetter: true, cadence: 'daily', window: 'any', shared: false, active: true });
  const view = scopeFor(p, { role: 'clinician', clinicianId: c1, patientId: pid });
  assert.equal(view.journal.length, 0);
  assert.equal(view.signals.length, 0);
  assert.equal(computeBrief(p, { role: 'clinician', clinicianId: c1, patientId: pid }, '2026-10-02').statements.length, 0);
});

test('delete account: needs the password, removes account, record and sessions', () => {
  const s = signUp({ name: 'Gone', email: 'gone@example.org', password: GOOD, role: 'patient' }, T0);
  const pid = s.ok ? s.value.accountId : '';
  const l = svc.logIn('gone@example.org', GOOD, '7.7.7.7', T0);
  const token = l.ok ? l.value.token : '';
  assert.equal(svc.deleteAccount(pid, 'wrong-password-77').ok, false);
  assert.equal(svc.deleteAccount(pid, GOOD).ok, true);
  assert.equal(store.getPatient(pid), undefined);
  assert.equal(svc.resolveSession(token, T0 + 1), null);
  assert.equal(svc.logIn('gone@example.org', GOOD, '7.7.7.8', T0).ok, false);
});

test('persistence: state survives a restart, file is private, sessions survive, no plaintext secrets on disk', () => {
  const clin = mkClinician('persist@example.org');
  const l = svc.logIn('persist@example.org', GOOD, '8.8.8.8', T0);
  const token = l.ok ? l.value.token : '';
  store.persistStore();
  assert.ok(existsSync(process.env.PX_DATA_FILE!));
  const raw = readFileSync(process.env.PX_DATA_FILE!, 'utf8');
  assert.ok(!raw.includes(GOOD), 'no plaintext password on disk');
  assert.ok(!raw.includes(token), 'no plaintext session token on disk');
  assert.ok(!raw.includes('pilot-secret-123'));
  if (process.platform !== 'win32') {
    assert.equal(statSync(process.env.PX_DATA_FILE!).mode & 0o077, 0, 'file is not group/world accessible');
  }
  store._resetStoreForTests();
  assert.ok(store.getStore().accounts.some((a) => a.email === 'persist@example.org'));
  assert.equal(svc.resolveSession(token, T0 + 5)!.id, clin);
  assert.equal(svc.logIn('persist@example.org', GOOD, '8.8.8.9', T0).ok, true);
});

test('sign-up is rate limited per IP', () => {
  let last = true;
  for (let i = 0; i < 12; i++) last = svc.signUp({ name: 'Bulk', email: `bulk${i}@example.org`, password: GOOD, role: 'patient', ip: '55.55.55.55' }, T0 + 99_000_000).ok;
  assert.equal(last, false);
});
