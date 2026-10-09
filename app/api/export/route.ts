import { NextResponse } from 'next/server';
import { currentActorOrNull } from '@/lib/session';
import { requirePatientSelf, AuthError } from '@/lib/auth/demo';
import { logAudit } from '@/lib/data/store';

export const dynamic = 'force-dynamic';

/** A patient can export only their own record. Never accepts an id from the client. */
export async function GET() {
  try {
    const actor = currentActorOrNull();
    if (!actor) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const data = requirePatientSelf(actor);
    logAudit(actor.id, 'patient', 'export', data.patientId);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    throw e;
  }
}
