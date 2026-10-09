'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { COOKIE, SESSION_COOKIE, currentActorOrNull } from '@/lib/session';
import { signUp as svcSignUp, logIn as svcLogIn, logOut as svcLogOut, createInvite, redeemInvite, unlinkClinician, deleteAccount } from '@/lib/auth/service';
import { requirePatientSelf, requireClinicianPatientAccess, requireActor, AuthError } from '@/lib/auth/demo';
import {
  addEntry, addFocusCheck, addMoment, addAgenda, addJournal, setConsent, setEdgeStatus, logAudit, nextId, addRecap, getStore, persistStore,
  addGoalTo, updateFocus, addAssessmentTo,
} from '@/lib/data/store';
import { str, num, oneOf, bool, SIGNAL_RANGE, ValidationError } from '@/lib/validate';
import { isShowcase } from '@/lib/config';
import { validateNewSignal, canResume } from '@/lib/domain/signals';
import { validateNewFocus } from '@/lib/domain/focus';
import { validateNewNode, validateNewEdge } from '@/lib/domain/map/edit';
import { validateNewGoal, validateNewStep } from '@/lib/domain/goals';
import { newGad7 } from '@/lib/domain/gad7';
import { SIGNAL_SUGGESTIONS } from '@/lib/domain/signals';
import { addSignalTo, setSignalActive, addFocusTo, setNextSession, markSessionOccurred, setAgendaStatus, setAgendaShared, addNodeTo, addEdgeTo, setTimezone, completeOnboarding } from '@/lib/data/store';
import { todayIn, isDayString, addDays, isValidTimezone } from '@/lib/domain/dates';
import { crisisScreen } from '@/lib/domain/safety/crisis';
import { computeBrief } from '@/lib/domain/insights/brief';
import { scopeFor } from '@/lib/domain/insights/scope';
import { polish } from '@/lib/ai/polish';
import { AiError } from '@/lib/ai/provider';
import type { Scope, Viewer, Relation } from '@/lib/domain/types';

const SCOPES: readonly Scope[] = ['share_checkins', 'share_moments_default', 'share_map', 'share_early_signs', 'share_focus', 'share_assessments', 'allow_ai_analysis'];

/** Persist (product mode) then refresh cached pages. Call after every successful mutation. */
function commit(path: string, type?: 'layout' | 'page') {
  persistStore();
  revalidatePath(path, type);
}

function patientOrRedirect() {
  const a = currentActorOrNull();
  if (!a) redirect('/');
  try {
    return { actor: a, data: requirePatientSelf(a) };
  } catch (e) {
    if (e instanceof AuthError) redirect('/');
    throw e;
  }
}

function fail(message: string, back: string): never {
  redirect(`${back}?error=${encodeURIComponent(message)}`);
}

export async function signIn(fd: FormData) {
  if (!isShowcase()) redirect('/'); // product mode uses real authentication, not personas
  const id = str(fd, 'userId', 40, { required: true });
  const a = requireActor(id);
  cookies().set(COOKIE, a.id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 });
  redirect(a.role === 'patient' ? '/patient/today' : '/clinician');
}
export async function signOut() {
  if (isShowcase()) cookies().delete(COOKIE);
  else {
    svcLogOut(cookies().get(SESSION_COOKIE)?.value);
    persistStore();
    cookies().delete(SESSION_COOKIE);
  }
  redirect('/');
}
export async function resetDemo() {
  if (!isShowcase()) redirect('/');
  (globalThis as unknown as { __px_store?: unknown }).__px_store = undefined;
  getStore();
  commit('/', 'layout');
  redirect('/');
}

export async function answerSignal(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  try {
    const signalId = str(fd, 'signalId', 40, { required: true });
    const sig = data.signals.find((s) => s.id === signalId);
    if (!sig) throw new ValidationError('unknown signal');
    const [lo, hi] = SIGNAL_RANGE[sig.kind];
    addEntry(data, signalId, num(fd, 'value', lo, hi), todayIn(data.timezone));
    logAudit(actor.id, 'patient', 'entry.add', data.patientId);
  } catch (e) {
    if (e instanceof ValidationError) fail(e.message, '/patient/today');
    throw e;
  }
  commit('/patient', 'layout');
  const back = fd.get('back');
  redirect(back === '/patient/anxiety' ? '/patient/anxiety' : '/patient/today');
}

export async function focusCheck(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  try {
    const focusId = str(fd, 'focusId', 40, { required: true });
    if (!data.focusItems.some((f) => f.id === focusId)) throw new ValidationError('unknown focus item');
    const status = oneOf(fd, 'status', ['done', 'partial', 'not_done'] as const);
    const obstacle = str(fd, 'obstacle', 40) || undefined;
    addFocusCheck(data, focusId, todayIn(data.timezone), status, status === 'not_done' ? obstacle : undefined);
    logAudit(actor.id, 'patient', 'focus.check', data.patientId);
  } catch (e) {
    if (e instanceof ValidationError) fail(e.message, '/patient/today');
    throw e;
  }
  commit('/patient', 'layout');
  redirect('/patient/today');
}

export async function focusNotDone(fd: FormData) {
  fd.set('status', 'not_done');
  return focusCheck(fd);
}

export async function addMomentAction(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  let crisis = false;
  try {
    const input = {
      day: todayIn(data.timezone),
      situation: str(fd, 'situation', 120, { required: true }),
      thought: str(fd, 'thought', 200),
      emotion: str(fd, 'emotion', 60),
      intensity: num(fd, 'intensity', 0, 10),
      behavior: str(fd, 'behavior', 120),
      visibility: data.consents.share_moments_default && fd.get('visibility') !== 'private' ? ('shared' as const) : fd.get('visibility') === 'shared' ? ('shared' as const) : ('private' as const),
      tools: data.tools.filter((t) => fd.getAll('tools').includes(t.id)).map((t) => t.id),
    };
    crisis = crisisScreen([input.situation, input.thought, input.emotion, input.behavior].join(' '));
    addMoment(data, input);
    logAudit(actor.id, 'patient', 'moment.add', data.patientId);
  } catch (e) {
    if (e instanceof ValidationError) fail(e.message, '/patient/moment');
    throw e;
  }
  commit('/patient', 'layout');
  redirect(crisis ? '/patient/support' : '/patient/today');
}

export async function addAgendaAction(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  try {
    const text = str(fd, 'text', 240, { required: true });
    addAgenda(data, text, todayIn(data.timezone), fd.get('shared') === 'true');
    logAudit(actor.id, 'patient', 'agenda.add', data.patientId);
    if (crisisScreen(text)) {
      commit('/patient', 'layout');
      redirect('/patient/support');
    }
  } catch (e) {
    if (e instanceof ValidationError) fail(e.message, '/patient/today');
    throw e;
  }
  commit('/patient', 'layout');
  redirect('/patient/today');
}

export async function addJournalAction(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  let crisis = false;
  try {
    const text = str(fd, 'text', 4000, { required: true });
    const vis = oneOf(fd, 'visibility', ['private', 'shared'] as const);
    addJournal(data, text, todayIn(data.timezone), vis);
    crisis = crisisScreen(text);
    logAudit(actor.id, 'patient', 'journal.add', data.patientId);
  } catch (e) {
    if (e instanceof ValidationError) fail(e.message, '/patient/journal');
    throw e;
  }
  commit('/patient', 'layout');
  redirect(crisis ? '/patient/support' : '/patient/journal');
}

export async function setConsentAction(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  const scope = oneOf(fd, 'scope', SCOPES);
  setConsent(data, scope, bool(fd, 'value'));
  logAudit(actor.id, 'patient', `consent.${scope}.${bool(fd, 'value') ? 'on' : 'off'}`, data.patientId);
  commit('/', 'layout');
  redirect('/patient/you');
}

export async function toggleSignalShare(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  const id = str(fd, 'signalId', 40, { required: true });
  data.signals = data.signals.map((s) => (s.id === id ? { ...s, shared: bool(fd, 'value') } : s));
  logAudit(actor.id, 'patient', 'signal.share', data.patientId);
  commit('/', 'layout');
  redirect('/patient/you');
}

export async function toggleMomentVisibility(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  const id = str(fd, 'momentId', 40, { required: true });
  const vis = oneOf(fd, 'visibility', ['private', 'shared'] as const);
  data.moments = data.moments.map((m) => (m.id === id ? { ...m, visibility: vis } : m));
  logAudit(actor.id, 'patient', 'moment.visibility', data.patientId);
  commit('/', 'layout');
  redirect('/patient/journal');
}

/** Patient responses to a Map link: yes / no / unsure. */
export async function patientEdgeResponse(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  const edgeId = str(fd, 'edgeId', 40, { required: true });
  const answer = oneOf(fd, 'answer', ['yes', 'no', 'unsure'] as const);
  const edge = data.edges.find((e) => e.id === edgeId);
  if (!edge) fail('unknown link', '/patient/map');
  if (answer === 'yes') setEdgeStatus(data, edgeId, edge.status === 'clinician_hypothesis' ? 'confirmed_together' : edge.status === 'proposed' ? 'patient_belief' : edge.status);
  if (answer === 'no') setEdgeStatus(data, edgeId, 'dismissed');
  logAudit(actor.id, 'patient', `edge.${answer}`, data.patientId);
  commit('/', 'layout');
  redirect('/patient/map');
}

export async function savePatientRecapNote(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  const text = str(fd, 'text', 400, { required: true });
  addJournal(data, `After session: ${text}`, todayIn(data.timezone), 'private');
  logAudit(actor.id, 'patient', 'recap.note', data.patientId);
  commit('/patient', 'layout');
  redirect('/patient/today');
}

// ---------------- clinician actions ----------------
function clinicianPatient(fd: FormData) {
  const a = currentActorOrNull();
  if (!a) redirect('/');
  const patientId = str(fd, 'patientId', 40, { required: true });
  try {
    return { actor: a, data: requireClinicianPatientAccess(a, patientId), patientId };
  } catch (e) {
    if (e instanceof AuthError) redirect('/clinician');
    throw e;
  }
}

export async function saveRecap(fd: FormData) {
  const { actor, data, patientId } = clinicianPatient(fd);
  const text = str(fd, 'text', 600, { required: true });
  addRecap(patientId, todayIn(data.timezone), text);
  const commitment = str(fd, 'commitment', 120);
  if (commitment) {
    data.focusItems.push({ id: nextId('f'), kind: 'commitment', title: commitment, startDay: todayIn(data.timezone), signalIds: [], createdBy: 'clinician', status: 'active' });
  }
  logAudit(actor.id, 'clinician', 'recap.save', patientId);
  commit('/', 'layout');
  redirect(`/clinician/patients/${patientId}?tab=plan`);
}

const RELATIONS: readonly Relation[] = ['appears_with', 'tends_to_follow', 'may_maintain', 'may_reduce', 'blocks'];
export async function proposeEdge(fd: FormData) {
  const { actor, data, patientId } = clinicianPatient(fd);
  const viewer: Viewer = { role: 'clinician', clinicianId: actor.id, patientId };
  const visible = scopeFor(data, viewer); // a clinician can only connect nodes they can already see
  const from = str(fd, 'from', 60, { required: true });
  const to = str(fd, 'to', 60, { required: true });
  const relation = oneOf(fd, 'relation', RELATIONS);
  if (from !== to && visible.nodes.some((n) => n.id === from) && visible.nodes.some((n) => n.id === to) && !data.edges.some((e) => e.from === from && e.to === to)) {
    data.edges.push({ id: nextId('e'), from, to, relation, status: 'clinician_hypothesis', visibleToPatient: true });
    logAudit(actor.id, 'clinician', 'edge.propose', patientId);
  }
  commit('/', 'layout');
  redirect(`/clinician/patients/${patientId}?tab=map`);
}

export async function confirmEdgeClinician(fd: FormData) {
  const { actor, data, patientId } = clinicianPatient(fd);
  const viewer: Viewer = { role: 'clinician', clinicianId: actor.id, patientId };
  const edgeId = str(fd, 'edgeId', 40, { required: true });
  const visible = scopeFor(data, viewer);
  const edge = visible.edges.find((e) => e.id === edgeId);
  if (edge && (edge.status === 'patient_belief' || edge.status === 'proposed' || edge.status === 'clinician_hypothesis')) {
    setEdgeStatus(data, edgeId, edge.status === 'patient_belief' ? 'confirmed_together' : 'clinician_hypothesis');
    logAudit(actor.id, 'clinician', 'edge.confirm', patientId);
  }
  commit('/', 'layout');
  redirect(`/clinician/patients/${patientId}?tab=map`);
}

/** Optional AI wording for a Brief. Needs consent when the viewer is a clinician. Always verified. */
export async function polishBrief(fd: FormData) {
  const a = currentActorOrNull();
  if (!a) redirect('/');
  const patientId = str(fd, 'patientId', 40, { required: true });
  let viewer: Viewer;
  let back: string;
  let data;
  try {
    if (a.role === 'clinician') {
      data = requireClinicianPatientAccess(a, patientId);
      if (!data.consents.allow_ai_analysis) fail('The patient has not allowed AI wording.', `/clinician/patients/${patientId}`);
      viewer = { role: 'clinician', clinicianId: a.id, patientId };
      back = `/clinician/patients/${patientId}`;
    } else {
      data = requirePatientSelf(a);
      viewer = { role: 'patient', patientId: data.patientId };
      back = '/patient/history';
    }
  } catch (e) {
    if (e instanceof AuthError) redirect('/');
    throw e;
  }
  const brief = computeBrief(data, viewer, todayIn(data.timezone));
  try {
    const r = await polish(brief.statements);
    getStore().polished.set(`${viewer.role}:${patientId}`, { at: new Date().toISOString(), statements: r.statements });
    logAudit(a.id, a.role, 'ai.polish', patientId); // content-free
  } catch (e) {
    const code = e instanceof AiError ? e.code : 'AI_HTTP_ERROR';
    redirect(`${back}?aiError=${code}`);
  }
  commit('/', 'layout');
  redirect(back);
}


// ---------------- Slice 1: patient actions ----------------
export async function createSignalAction(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  try {
    const r = validateNewSignal(data.signals, {
      label: str(fd, 'label', 60, { required: true }),
      kind: str(fd, 'kind', 20, { required: true }),
      unit: str(fd, 'unit', 10),
      higherIsBetter: fd.get('direction') === 'higher_is_better',
      cadence: str(fd, 'cadence', 10, { required: true }),
      window: str(fd, 'window', 10, { required: true }),
    });
    if (!r.ok) throw new ValidationError(r.error);
    addSignalTo(data, r.value);
    logAudit(actor.id, 'patient', 'signal.create', data.patientId);
  } catch (e) {
    if (e instanceof ValidationError) fail(e.message, '/patient/you');
    throw e;
  }
  commit('/', 'layout');
  redirect('/patient/you');
}

export async function toggleSignalActiveAction(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  const id = str(fd, 'signalId', 60, { required: true });
  const active = bool(fd, 'active');
  if (!data.signals.some((s) => s.id === id)) fail('Unknown signal.', '/patient/you');
  if (active) {
    const r = canResume(data.signals, id);
    if (!r.ok) fail(r.error, '/patient/you');
  }
  setSignalActive(data, id, active);
  logAudit(actor.id, 'patient', active ? 'signal.resume' : 'signal.pause', data.patientId);
  commit('/', 'layout');
  redirect('/patient/you');
}

export async function setTimezoneAction(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  const tz = str(fd, 'timezone', 64, { required: true });
  if (!isValidTimezone(tz) || !setTimezone(data, tz)) fail('That time zone is not recognised.', '/patient/you');
  logAudit(actor.id, 'patient', 'timezone.set', data.patientId);
  commit('/', 'layout');
  redirect('/patient/you');
}

export async function completeOnboardingAction(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  const tz = str(fd, 'timezone', 64);
  const chosen = fd.getAll('signal').filter((x): x is string => typeof x === 'string');
  const consents: Partial<Record<Scope, boolean>> = {};
  for (const sc of SCOPES) consents[sc] = fd.get(`consent_${sc}`) === 'on';
  const r = completeOnboarding(data, chosen, consents, tz || undefined);
  if (!r.ok) fail(r.error ?? 'Could not finish.', '/patient/welcome');
  logAudit(actor.id, 'patient', 'onboarding.complete', data.patientId);
  commit('/', 'layout');
  redirect('/patient/today');
}

export async function agendaStatusAction(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  const id = str(fd, 'agendaId', 60, { required: true });
  if (!data.agenda.some((x) => x.id === id)) fail('Unknown item.', '/patient/today');
  setAgendaStatus(data, id, oneOf(fd, 'status', ['open', 'done'] as const));
  logAudit(actor.id, 'patient', 'agenda.status', data.patientId);
  commit('/', 'layout');
  redirect('/patient/today');
}

export async function agendaShareAction(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  const id = str(fd, 'agendaId', 60, { required: true });
  if (!data.agenda.some((x) => x.id === id)) fail('Unknown item.', '/patient/today');
  setAgendaShared(data, id, bool(fd, 'shared'));
  logAudit(actor.id, 'patient', 'agenda.share', data.patientId);
  commit('/', 'layout');
  redirect('/patient/today');
}

export async function addNodeAction(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  const r = validateNewNode(data.nodes, str(fd, 'label', 80, { required: true }), str(fd, 'kind', 20, { required: true }));
  if (!r.ok) fail(r.error, '/patient/map');
  addNodeTo(data, r.value);
  logAudit(actor.id, 'patient', 'map.node.add', data.patientId);
  commit('/', 'layout');
  redirect('/patient/map');
}

export async function addEdgeAction(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  const r = validateNewEdge(data.nodes, data.edges, str(fd, 'from', 60, { required: true }), str(fd, 'to', 60, { required: true }), str(fd, 'relation', 20, { required: true }));
  if (!r.ok) fail(r.error, '/patient/map');
  addEdgeTo(data, r.value, 'patient_belief'); // starts as the person's own belief; "observed" is computed, never set
  logAudit(actor.id, 'patient', 'map.edge.add', data.patientId);
  commit('/', 'layout');
  redirect('/patient/map');
}

// ---------------- Slice 1: clinician actions ----------------
export async function createFocusAction(fd: FormData) {
  const { actor, data, patientId } = clinicianPatient(fd);
  const back = `/clinician/patients/${patientId}`;
  const today = todayIn(data.timezone);
  const visible = scopeFor(data, { role: 'clinician', clinicianId: actor.id, patientId }).signals; // only signals the patient shares
  try {
    const kind = str(fd, 'kind', 20, { required: true });
    const pair =
      kind === 'hypothesis'
        ? { a: str(fd, 'pairA', 60), b: str(fd, 'pairB', 60), aState: str(fd, 'aState', 10), bState: str(fd, 'bState', 10), lag: Number(fd.get('lag') ?? 0) }
        : undefined;
    const r = validateNewFocus(visible, today, {
      kind,
      title: str(fd, 'title', 200, { required: true }),
      startDay: str(fd, 'startDay', 10) || today,
      reviewDay: str(fd, 'reviewDay', 10) || undefined,
      signalIds: fd.getAll('signalIds').filter((x): x is string => typeof x === 'string'),
      pair,
    });
    if (!r.ok) throw new ValidationError(r.error);
    addFocusTo(data, r.value, 'clinician');
    logAudit(actor.id, 'clinician', 'focus.create', patientId);
  } catch (e) {
    if (e instanceof ValidationError) redirect(`${back}?tab=plan&error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  commit('/', 'layout');
  redirect(`${back}?tab=plan`);
}

export async function setNextSessionAction(fd: FormData) {
  const { actor, data, patientId } = clinicianPatient(fd);
  const today = todayIn(data.timezone);
  const day = str(fd, 'day', 10, { required: true });
  if (!isDayString(day) || day < today || day > addDays(today, 365)) {
    redirect(`/clinician/patients/${patientId}?tab=plan&error=${encodeURIComponent('Choose a date from today up to a year ahead.')}`);
  }
  setNextSession(data, day, today);
  logAudit(actor.id, 'clinician', 'session.schedule', patientId);
  commit('/', 'layout');
  redirect(`/clinician/patients/${patientId}?tab=plan`);
}

export async function markSessionHappenedAction(fd: FormData) {
  const { actor, data, patientId } = clinicianPatient(fd);
  const id = str(fd, 'sessionId', 60, { required: true });
  if (data.sessions.some((s) => s.id === id)) {
    markSessionOccurred(data, id);
    logAudit(actor.id, 'clinician', 'session.occurred', patientId);
  }
  commit('/', 'layout');
  redirect(`/clinician/patients/${patientId}?tab=plan`);
}



// ---------------- product mode: accounts ----------------
function clientIp(): string {
  const h = headers();
  return (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
}
function setSessionCookie(token: string) {
  cookies().set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 7 });
}

export async function signUpAction(fd: FormData) {
  if (isShowcase()) redirect('/');
  let target = '/patient/welcome';
  try {
    const email = str(fd, 'email', 254, { required: true });
    const password = str(fd, 'password', 200, { required: true });
    const r = svcSignUp({
      name: str(fd, 'name', 80, { required: true }),
      email,
      password,
      role: str(fd, 'role', 20, { required: true }),
      inviteCode: str(fd, 'inviteCode', 20) || undefined,
      clinicianCode: str(fd, 'clinicianCode', 100) || undefined,
      timezone: str(fd, 'timezone', 64) || undefined,
      ip: clientIp(),
    });
    if (!r.ok) throw new ValidationError(r.error);
    const l = svcLogIn(email, password, clientIp());
    if (!l.ok) throw new ValidationError(l.error);
    persistStore();
    setSessionCookie(l.value.token);
    target = r.value.role === 'clinician' ? '/clinician' : '/patient/welcome';
  } catch (e) {
    if (e instanceof ValidationError) fail(e.message, '/signup');
    throw e;
  }
  redirect(target);
}

export async function logInAction(fd: FormData) {
  if (isShowcase()) redirect('/');
  let target = '/';
  try {
    const r = svcLogIn(str(fd, 'email', 254, { required: true }), str(fd, 'password', 200, { required: true }), clientIp());
    if (!r.ok) throw new ValidationError(r.error);
    persistStore();
    setSessionCookie(r.value.token);
    target = r.value.actor.role === 'clinician' ? '/clinician' : '/patient/today';
  } catch (e) {
    if (e instanceof ValidationError) fail(e.message, '/login');
    throw e;
  }
  redirect(target);
}

function clinicianOrRedirect() {
  const a = currentActorOrNull();
  if (!a || a.role !== 'clinician') redirect('/');
  return a;
}

export async function createInviteAction() {
  const a = clinicianOrRedirect();
  const r = createInvite(a.id);
  if (!r.ok) redirect(`/clinician?error=${encodeURIComponent(r.error)}`);
  logAudit(a.id, 'clinician', 'invite.create', a.id);
  persistStore();
  redirect(`/clinician/invite?code=${encodeURIComponent(r.value.code)}`);
}

export async function connectClinicianAction(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  const r = redeemInvite(data.patientId, str(fd, 'inviteCode', 20, { required: true }));
  if (!r.ok) fail(r.error, '/patient/you');
  logAudit(actor.id, 'patient', 'link.connect', data.patientId);
  commit('/', 'layout');
  redirect('/patient/you');
}

export async function disconnectClinicianAction() {
  const { actor, data } = patientOrRedirect();
  unlinkClinician(data.patientId);
  logAudit(actor.id, 'patient', 'link.end', data.patientId);
  commit('/', 'layout');
  redirect('/patient/you');
}

export async function deleteAccountAction(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  if (fd.get('confirm') !== 'on') fail('Tick the box to confirm.', '/patient/you');
  const r = deleteAccount(data.patientId, str(fd, 'password', 200, { required: true }));
  if (!r.ok) fail(r.error, '/patient/you');
  logAudit(actor.id, 'patient', 'account.delete', actor.id);
  persistStore();
  cookies().delete(SESSION_COOKIE);
  redirect('/');
}

// ---------------- goals ----------------
export async function createGoalAction(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  const r = validateNewGoal(data.focusItems, todayIn(data.timezone), {
    title: str(fd, 'title', 200, { required: true }),
    why: str(fd, 'why', 300),
    targetDay: str(fd, 'targetDay', 10) || undefined,
    steps: [1, 2, 3, 4, 5].map((i) => str(fd, `step${i}`, 200)),
    shared: fd.get('shared') === 'on',
  });
  if (!r.ok) fail(r.error, '/patient/goals');
  addGoalTo(data, r.value);
  logAudit(actor.id, 'patient', 'goal.create', data.patientId);
  commit('/', 'layout');
  redirect('/patient/goals');
}

function ownGoal(data: ReturnType<typeof patientOrRedirect>['data'], id: string) {
  const g = data.focusItems.find((f) => f.id === id && f.kind === 'goal');
  if (!g) fail('Unknown goal.', '/patient/goals');
  return g;
}

export async function toggleGoalStepAction(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  const g = ownGoal(data, str(fd, 'goalId', 60, { required: true }));
  const stepId = str(fd, 'stepId', 20, { required: true });
  if (!(g.steps ?? []).some((s) => s.id === stepId)) fail('Unknown step.', '/patient/goals');
  updateFocus(data, g.id, (f) => ({ ...f, steps: (f.steps ?? []).map((s) => (s.id === stepId ? { ...s, done: !s.done } : s)) }));
  logAudit(actor.id, 'patient', 'goal.step', data.patientId);
  commit('/', 'layout');
  redirect('/patient/goals');
}

export async function addGoalStepAction(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  const g = ownGoal(data, str(fd, 'goalId', 60, { required: true }));
  const r = validateNewStep(g, str(fd, 'text', 200, { required: true }));
  if (!r.ok) fail(r.error, '/patient/goals');
  updateFocus(data, g.id, (f) => ({ ...f, steps: [...(f.steps ?? []), r.value] }));
  logAudit(actor.id, 'patient', 'goal.step.add', data.patientId);
  commit('/', 'layout');
  redirect('/patient/goals');
}

export async function setGoalStatusAction(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  const g = ownGoal(data, str(fd, 'goalId', 60, { required: true }));
  const status = oneOf(fd, 'status', ['active', 'completed'] as const);
  updateFocus(data, g.id, (f) => ({ ...f, status }));
  logAudit(actor.id, 'patient', `goal.${status}`, data.patientId);
  commit('/', 'layout');
  redirect('/patient/goals');
}

export async function setGoalSharedAction(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  const g = ownGoal(data, str(fd, 'goalId', 60, { required: true }));
  if (g.createdBy !== 'patient') fail('Only your own goals can be switched between private and shared.', '/patient/goals');
  updateFocus(data, g.id, (f) => ({ ...f, shared: bool(fd, 'shared') }));
  logAudit(actor.id, 'patient', 'goal.share', data.patientId);
  commit('/', 'layout');
  redirect('/patient/goals');
}

// ---------------- anxiety ----------------
export async function startAnxietyTrackingAction() {
  const { actor, data } = patientOrRedirect();
  if (!data.signals.some((s) => s.id === 'anxiety')) {
    const sug = SIGNAL_SUGGESTIONS.find((s) => s.id === 'anxiety')!;
    const { why: _why, ...rest } = sug;
    const check = validateNewSignal(data.signals, { label: rest.label, kind: rest.kind, unit: rest.unit, higherIsBetter: rest.higherIsBetter, cadence: rest.cadence, window: rest.window });
    if (!check.ok) fail(check.error, '/patient/anxiety');
    addSignalTo(data, { ...rest, shared: false, active: true });
    logAudit(actor.id, 'patient', 'anxiety.start', data.patientId);
  }
  commit('/', 'layout');
  redirect('/patient/anxiety');
}

export async function submitGad7Action(fd: FormData) {
  const { actor, data } = patientOrRedirect();
  const answers = [1, 2, 3, 4, 5, 6, 7].map((i) => {
    const v = fd.get(`q${i}`);
    return typeof v === 'string' && v !== '' ? Number(v) : NaN;
  });
  const r = newGad7(answers, todayIn(data.timezone), nextId('gad'));
  if (!r.ok) fail(r.error, '/patient/anxiety/gad7');
  addAssessmentTo(data, r.value);
  logAudit(actor.id, 'patient', 'assessment.gad7', data.patientId);
  commit('/', 'layout');
  redirect('/patient/anxiety');
}
