// Password handling with Node's built-in scrypt. No plaintext is ever stored or logged.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { ok, err } from '../domain/result.ts';
import type { Result } from '../domain/result.ts';

const KEYLEN = 64;
const N = 16384;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, { N });
  return `scrypt$${N}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]);
  if (!Number.isInteger(n) || n < 1024 || n > 1 << 20) return false;
  const salt = Buffer.from(parts[2], 'hex');
  const expected = Buffer.from(parts[3], 'hex');
  const actual = scryptSync(password, salt, expected.length, { N: n });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// A hash of nothing in particular, used so a login for an unknown email takes as long as a real one.
export const DUMMY_HASH = hashPassword('not-a-real-password-just-for-timing');

const COMMON = new Set(['password', 'password1', 'password123', '1234567890', 'qwertyuiop', 'iloveyou12', 'letmein123', 'welcome123', 'admin12345', 'abc1234567']);

export function validatePassword(password: string, email: string, name: string): Result<true> {
  if (password.length < 10) return err('Use at least 10 characters.');
  if (password.length > 128) return err('Use at most 128 characters.');
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return err('That password is too common. Choose something less guessable.');
  if (email && lower.includes(email.split('@')[0].toLowerCase()) && email.split('@')[0].length >= 4) return err('Your password should not contain your email name.');
  if (name.trim().length >= 4 && lower.includes(name.trim().toLowerCase())) return err('Your password should not contain your name.');
  if (/^(.)\1+$/.test(password)) return err('Choose a password with more variety.');
  return ok(true);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): Result<string> {
  const e = normalizeEmail(email);
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return err('Enter a valid email address.');
  return ok(e);
}
