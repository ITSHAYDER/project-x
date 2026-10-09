// Accounts, sessions, invitations. Server-side only. Callers persist with persistStore() after success.
import { randomBytes, createHash } from 'node:crypto';
import { getStore, nextId, newPatientData, putPatient, removePatient, getPatient } from '../data/store.ts';
import { hashPassword, verifyPassword, validatePassword, validateEmail, DUMMY_HASH } from './password.ts';
import { ok, err } from '../domain/result.ts';
import type { Result } from '../domain/result.ts';
import { isValidTimezone } from '../domain/dates.ts';
import type { Actor } from './demo.ts';

const DAY = 86400000;
export const SESSION_TTL = 7 * DAY;
export const INVITE_TTL = 7 * DAY;
export const MAX_FAILED = 5;
export const LOCK_WINDOW = 15 * 60 * 1000;

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

// ---- rate limiting (in memory) ----
function recentAttempts(key: string, now: number): number[] {
  const s = getStore();
  const list = (s.attempts.get(key) ?? []).filter((t) => now - t < LOCK_WINDOW);
  s.attempts.set(key, list);
  return list;
}
function recordAttempt(key: string, now: number) {
  const list = recentAttempts(key, now);
  list.push(now);
}
function clearAttempts(key: string) {
  getStore().attempts.delete(key);
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  role: string;
  inviteCode?: string;
  clinicianCode?: string;
  timezone?: string;
  ip?: string;
}

/** The secret a clinician must know to register (set CLINICIAN_SIGNUP_CODE). Unset = clinician sign-up disabled. */
export function clinicianCodeConfigured(): boolean {
  return !!process.env.CLINICIAN_SIGNUP_CODE;
}

function constantEq(a: string, b: string): boolean {
  return sha(a) === sha(b);
}

export function signUp(input: SignUpInput, now = Date.now()): Result<{ accountId: string; role: 'patient' | 'clinician'; linked: boolean }> {
  const ipKey = `signup:${input.ip ?? 'unknown'}`;
  if (recentAttempts(ipKey, now).length >= 10) return err('Too many sign-ups from here. Please try again later.');
  recordAttempt(ipKey, now);

  const name = input.name.trim();
  if (name.length < 1 || name.length > 60) return err('Enter your first name or a nickname (up to 60 characters).');
  const email = validateEmail(input.email);
  if (!email.ok) return err(email.error);
  const pw = validatePassword(input.password, email.value, name);
  if (!pw.ok) return err(pw.error);
  if (input.role !== 'patient' && input.role !== 'clinician') return err('Choose whether you are signing up as a patient or a clinician.');
  const role = input.role;

  if (role === 'clinician') {
    if (!clinicianCodeConfigured()) return err('Clinician sign-up is not open yet. Ask the team for access.');
    if (!input.clinicianCode || !constantEq(input.clinicianCode.trim(), process.env.CLINICIAN_SIGNUP_CODE as string)) return err('That clinician access code is not valid.');
  }

  const s = getStore();
  if (s.accounts.some((a) => a.email === email.value)) return err('An account with that email already exists. Try logging in.');

  let inviteClinician: string | null = null;
  if (role === 'patient' && input.inviteCode && input.inviteCode.trim()) {
    const inv = findUsableInvite(input.inviteCode, now);
    if (!inv.ok) return err(inv.error);
    inviteClinician = inv.value.clinicianId;
  }

  const id = nextId(role === 'patient' ? 'p' : 'c');
  s.accounts.push({ id, email: email.value, name, role, passwordHash: hashPassword(input.password), createdAt: now });
  let linked = false;
  if (role === 'patient') {
    const tz = input.timezone && isValidTimezone(input.timezone) ? input.timezone : 'UTC';
    const p = newPatientData(id, name, tz);
    putPatient(p);
    if (inviteClinician && input.inviteCode) {
      const r = redeemInvite(id, input.inviteCode, now);
      linked = r.ok;
    }
  }
  return ok({ accountId: id, role, linked });
}

export function logIn(emailRaw: string, password: string, ip = 'unknown', now = Date.now()): Result<{ token: string; actor: Actor }> {
  const email = validateEmail(emailRaw);
  const key = `login:${email.ok ? email.value : 'invalid'}`;
  const ipKey = `loginip:${ip}`;
  const generic = 'Email or password is not right.';
  if (recentAttempts(key, now).length >= MAX_FAILED || recentAttempts(ipKey, now).length >= MAX_FAILED * 4) {
    return err('Too many attempts. Please wait 15 minutes and try again.');
  }
  const s = getStore();
  const acct = email.ok ? s.accounts.find((a) => a.email === email.value) : undefined;
  // Always do the same amount of hashing work so response time does not reveal whether the email exists.
  const good = verifyPassword(password, acct ? acct.passwordHash : DUMMY_HASH);
  if (!acct || !good) {
    recordAttempt(key, now);
    recordAttempt(ipKey, now);
    return err(generic);
  }
  clearAttempts(key);
  const token = randomBytes(32).toString('hex');
  s.sessions = s.sessions.filter((x) => x.expiresAt > now);
  s.sessions.push({ tokenHash: sha(token), accountId: acct.id, expiresAt: now + SESSION_TTL });
  return ok({ token, actor: { id: acct.id, role: acct.role, name: acct.name } });
}

export function resolveSession(token: string | undefined | null, now = Date.now()): Actor | null {
  if (!token || token.length < 32 || token.length > 200) return null;
  const s = getStore();
  const rec = s.sessions.find((x) => x.tokenHash === sha(token));
  if (!rec || rec.expiresAt <= now) return null;
  const acct = s.accounts.find((a) => a.id === rec.accountId);
  return acct ? { id: acct.id, role: acct.role, name: acct.name } : null;
}

export function logOut(token: string | undefined | null) {
  if (!token) return;
  const s = getStore();
  const h = sha(token);
  s.sessions = s.sessions.filter((x) => x.tokenHash !== h);
}

// ---- invitations ----
function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L

export function createInvite(clinicianId: string, now = Date.now()): Result<{ code: string; expiresAt: number }> {
  const s = getStore();
  const acct = s.accounts.find((a) => a.id === clinicianId);
  if (!acct || acct.role !== 'clinician') return err('Only clinicians can invite patients.');
  const open = s.invites.filter((i) => i.clinicianId === clinicianId && !i.usedAt && i.expiresAt > now);
  if (open.length >= 20) return err('You have many unused invites. Wait for them to be used or expire.');
  const bytes = randomBytes(8).toString('hex');
  let raw = '';
  for (let i = 0; i < 8; i++) raw += ALPHABET[parseInt(bytes.slice(i * 2, i * 2 + 2), 16) % ALPHABET.length];
  s.invites.push({ codeHash: sha(raw), clinicianId, expiresAt: now + INVITE_TTL });
  return ok({ code: `${raw.slice(0, 4)}-${raw.slice(4)}`, expiresAt: now + INVITE_TTL });
}

function findUsableInvite(code: string, now: number): Result<{ clinicianId: string }> {
  const n = normalizeCode(code);
  if (n.length !== 8) return err('That invite code is not valid.');
  const inv = getStore().invites.find((i) => i.codeHash === sha(n));
  if (!inv || inv.usedAt || inv.expiresAt <= now) return err('That invite code is not valid, has expired, or was already used.');
  return ok({ clinicianId: inv.clinicianId });
}

/** Links a patient to a clinician. Everything stays private until the patient chooses to share. */
export function redeemInvite(patientId: string, code: string, now = Date.now()): Result<{ clinicianId: string }> {
  const p = getPatient(patientId);
  if (!p) return err('Account not found.');
  if (p.linkedClinicianId) return err('You are already connected to a clinician. Disconnect first.');
  const attemptKey = `invite:${patientId}`;
  if (recentAttempts(attemptKey, now).length >= MAX_FAILED) return err('Too many tries. Please wait 15 minutes.');
  const found = findUsableInvite(code, now);
  if (!found.ok) {
    recordAttempt(attemptKey, now);
    return err(found.error);
  }
  const inv = getStore().invites.find((i) => i.codeHash === sha(normalizeCode(code)))!;
  inv.usedBy = patientId;
  inv.usedAt = now;
  p.linkedClinicianId = inv.clinicianId;
  return ok({ clinicianId: inv.clinicianId });
}

/** The patient ends the link. Clinician access stops immediately; the patient's record stays. */
export function unlinkClinician(patientId: string): Result<true> {
  const p = getPatient(patientId);
  if (!p) return err('Account not found.');
  p.linkedClinicianId = null;
  return ok(true);
}

/** Deletes the account, the record and sessions. Content-free audit rows keep only ids. */
export function deleteAccount(accountId: string, password: string): Result<true> {
  const s = getStore();
  const acct = s.accounts.find((a) => a.id === accountId);
  if (!acct) return err('Account not found.');
  if (!verifyPassword(password, acct.passwordHash)) return err('That password is not right.');
  s.accounts = s.accounts.filter((a) => a.id !== accountId);
  s.sessions = s.sessions.filter((x) => x.accountId !== accountId);
  s.invites = s.invites.filter((i) => i.clinicianId !== accountId);
  removePatient(accountId);
  return ok(true);
}
