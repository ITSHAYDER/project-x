// DEMO authentication and authorization. In production replace the cookie with Supabase Auth, keep
// the authorization functions: they are the single place every server entry point must call.
import type { PatientData } from '../domain/types.ts';
import { USERS, getPatient } from '../data/store.ts';

export type Actor = { id: string; role: 'patient' | 'clinician'; name: string };

export class AuthError extends Error {
  code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND';
  constructor(code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND') {
    super(code);
    this.code = code;
  }
}

export function actorFromId(id: string | undefined | null): Actor | null {
  if (!id) return null;
  const u = USERS.find((x) => x.id === id);
  return u ? { id: u.id, role: u.role, name: u.name } : null;
}

export function requireActor(id: string | undefined | null): Actor {
  const a = actorFromId(id);
  if (!a) throw new AuthError('UNAUTHENTICATED');
  return a;
}

/** A patient may only ever act on their own record. */
export function requirePatientSelf(actor: Actor): PatientData {
  if (actor.role !== 'patient') throw new AuthError('FORBIDDEN');
  const p = getPatient(actor.id);
  if (!p) throw new AuthError('NOT_FOUND');
  return p;
}

/**
 * A clinician may only act on a patient with an ACTIVE link to them. Unlinked access returns
 * NOT_FOUND (not FORBIDDEN) so IDs cannot be probed. Data visibility is further limited by
 * consent scopes inside the engine (scopeFor).
 */
export function requireClinicianPatientAccess(actor: Actor, patientId: string): PatientData {
  if (actor.role !== 'clinician') throw new AuthError('FORBIDDEN');
  const p = getPatient(patientId);
  if (!p || p.linkedClinicianId !== actor.id) throw new AuthError('NOT_FOUND');
  return p;
}
