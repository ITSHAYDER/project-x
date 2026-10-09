import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { requireActor, requirePatientSelf, requireClinicianPatientAccess, AuthError } from './auth/demo.ts';
import { resolveSession } from './auth/service.ts';
import { isShowcase } from './config.ts';
import type { Actor } from './auth/demo.ts';

export const COOKIE = 'px_user'; // showcase personas
export const SESSION_COOKIE = 'px_session'; // product mode: random token, only its hash is stored

export function currentActorOrNull(): Actor | null {
  if (!isShowcase()) return resolveSession(cookies().get(SESSION_COOKIE)?.value);
  try {
    return requireActor(cookies().get(COOKIE)?.value);
  } catch {
    return null;
  }
}

/** For pages: unauthenticated -> sign-in; wrong role -> sign-in; never reveals why. */
export function pageActor(role: 'patient' | 'clinician'): Actor {
  const a = currentActorOrNull();
  if (!a || a.role !== role) redirect('/');
  return a;
}
export function pagePatient(opts: { allowUnonboarded?: boolean } = {}) {
  const a = pageActor('patient');
  try {
    const data = requirePatientSelf(a);
    if (!data.onboarded && !opts.allowUnonboarded) redirect('/patient/welcome');
    return { actor: a, data };
  } catch (e) {
    if (e instanceof AuthError) redirect('/');
    throw e;
  }
}
export function pageClinicianPatient(patientId: string) {
  const a = pageActor('clinician');
  try {
    return { actor: a, data: requireClinicianPatientAccess(a, patientId) };
  } catch (e) {
    if (e instanceof AuthError) notFound(); // unlinked and unknown ids look identical
    throw e;
  }
}
