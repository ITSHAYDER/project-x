// In-memory DEMO store (resets when the server restarts). It stands in for Supabase so the product
// can be run and evaluated without any backend. The production schema is in supabase/migrations.
import type { Day, PatientData, Scope, EpistemicStatus, Visibility, Moment, MapNode, Signal, FocusItem, Relation, Assessment } from '../domain/types.ts';
import { buildAll, CLINICIAN } from './seed.ts';
import { appMode } from '../config.ts';
import { dataFilePath, readJson, writeJsonAtomic } from './persist.ts';
import { todayLocal, isValidTimezone } from '../domain/dates.ts';
import { SIGNAL_SUGGESTIONS, MAX_ACTIVE_SIGNALS } from '../domain/signals.ts';
import type { FocusDraft } from '../domain/focus.ts';

export interface AuditRecord {
  id: string;
  at: string;
  actorId: string;
  actorRole: 'patient' | 'clinician';
  action: string;
  patientId: string;
  // content-free by design: never store entry text here
}

export interface Account {
  id: string;
  email: string;
  name: string;
  role: 'patient' | 'clinician';
  passwordHash: string;
  createdAt: number;
}
export interface SessionRec {
  tokenHash: string;
  accountId: string;
  expiresAt: number;
}
export interface InviteRec {
  codeHash: string;
  clinicianId: string;
  expiresAt: number;
  usedBy?: string;
  usedAt?: number;
}

interface Store {
  seededFor: Day;
  patients: Map<string, PatientData>;
  audit: AuditRecord[];
  polished: Map<string, { at: string; statements: Array<{ id: string; text: string }> }>;
  recaps: Map<string, Array<{ day: Day; text: string }>>;
  counter: number;
  accounts: Account[];
  sessions: SessionRec[];
  invites: InviteRec[];
  attempts: Map<string, number[]>; // rate limiting (in memory only)
}

const g = globalThis as unknown as { __px_store?: Store };

/** Persistent mode = product mode, or an explicit PX_DATA_FILE (used by tests). */
export function isPersistent(): boolean {
  return appMode() === 'product' || !!process.env.PX_DATA_FILE;
}

interface Saved {
  counter: number;
  accounts: Account[];
  sessions: SessionRec[];
  invites: InviteRec[];
  patients: PatientData[];
  audit: AuditRecord[];
  recaps: Record<string, Array<{ day: Day; text: string }>>;
}

function emptyStore(today: Day): Store {
  return { seededFor: today, patients: new Map(), audit: [], polished: new Map(), recaps: new Map(), counter: 1000, accounts: [], sessions: [], invites: [], attempts: new Map() };
}

function migratePatient(p: PatientData): PatientData {
  // keep old files loadable as the schema grows
  return { ...p, assessments: p.assessments ?? [], timezone: p.timezone ?? 'UTC', onboarded: p.onboarded ?? true };
}

function loadPersistent(today: Day): Store {
  const st = emptyStore(today);
  const saved = readJson<Saved>(dataFilePath());
  if (saved) {
    st.counter = saved.counter ?? 1000;
    st.accounts = saved.accounts ?? [];
    st.sessions = saved.sessions ?? [];
    st.invites = saved.invites ?? [];
    st.patients = new Map((saved.patients ?? []).map((p) => [p.patientId, migratePatient(p)]));
    st.audit = saved.audit ?? [];
    st.recaps = new Map(Object.entries(saved.recaps ?? {}));
  }
  return st;
}

export function getStore(): Store {
  const today = todayLocal();
  if (isPersistent()) {
    if (!g.__px_store) g.__px_store = loadPersistent(today);
    return g.__px_store;
  }
  if (!g.__px_store || g.__px_store.seededFor !== today) {
    g.__px_store = { ...emptyStore(today), patients: new Map(buildAll(today, serverTimezone()).map((p) => [p.patientId, p])) };
  }
  return g.__px_store;
}

/** Write the store to disk (no-op in showcase mode). Call after any mutation in product mode. */
export function persistStore(): void {
  if (!isPersistent()) return;
  const s = getStore();
  const saved: Saved = {
    counter: s.counter,
    accounts: s.accounts,
    sessions: s.sessions.filter((x) => x.expiresAt > Date.now()),
    invites: s.invites,
    patients: [...s.patients.values()],
    audit: s.audit.slice(-2000),
    recaps: Object.fromEntries(s.recaps),
  };
  writeJsonAtomic(dataFilePath(), saved);
}

/** For tests: forget the in-memory copy so the next getStore() reloads from disk. */
export function _resetStoreForTests(): void {
  g.__px_store = undefined;
}

export function serverTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export const USERS = [
  { id: 'p_alex', role: 'patient' as const, name: 'Alex', blurb: '12 weeks of data, a planted formulation, a session in 2 days' },
  { id: 'p_sam', role: 'patient' as const, name: 'Sam', blurb: 'Day six: shows the honest “still learning” states' },
  { id: 'p_riley', role: 'patient' as const, name: 'Riley', blurb: 'No clinician: the record is theirs, stand-alone' },
  { id: 'p_jordan', role: 'patient' as const, name: 'Jordan', blurb: 'Brand new, just invited: walk through onboarding and day zero' },
  { id: CLINICIAN.id, role: 'clinician' as const, name: CLINICIAN.name, blurb: 'Sees only what each patient has agreed to share' },
];

/** Display name for any user id: demo personas first, then real accounts. */
export function nameOf(id: string): string {
  const demo = USERS.find((u) => u.id === id);
  if (demo) return demo.name;
  return getStore().accounts.find((a) => a.id === id)?.name ?? 'Your clinician';
}

export function nextId(prefix: string): string {
  const s = getStore();
  s.counter += 1;
  return `${prefix}_${s.counter}`;
}

export function getPatient(id: string): PatientData | undefined {
  return getStore().patients.get(id);
}
export function listPatients(): PatientData[] {
  return [...getStore().patients.values()];
}
export function newPatientData(id: string, name: string, timezone: string): PatientData {
  return {
    patientId: id,
    displayName: name,
    signals: [], entries: [], moments: [], nodes: [], edges: [], focusItems: [], focusChecks: [], tools: [], toolUses: [],
    sessions: [], agenda: [], journal: [], assessments: [],
    consents: { share_checkins: false, share_moments_default: false, share_map: false, share_early_signs: false, share_focus: false, share_assessments: false, allow_ai_analysis: false },
    linkedClinicianId: null,
    timezone,
    onboarded: false,
  };
}
export function putPatient(p: PatientData) {
  getStore().patients.set(p.patientId, p);
}
export function removePatient(id: string) {
  const s = getStore();
  s.patients.delete(id);
  s.recaps.delete(id);
}

export function listClinicianPatients(clinicianId: string): PatientData[] {
  return listPatients().filter((p) => p.linkedClinicianId === clinicianId);
}

export function logAudit(actorId: string, actorRole: 'patient' | 'clinician', action: string, patientId: string) {
  const s = getStore();
  s.audit.push({ id: nextId('au'), at: new Date().toISOString(), actorId, actorRole, action, patientId });
}
export function auditFor(patientId: string): AuditRecord[] {
  return getStore().audit.filter((a) => a.patientId === patientId).slice(-50).reverse();
}

// ---- mutations (callers MUST have authorized the actor already) ----
export function addEntry(p: PatientData, signalId: string, value: number, day: Day) {
  p.entries = p.entries.filter((e) => !(e.signalId === signalId && e.day === day));
  p.entries.push({ id: nextId('e'), signalId, day, value });
}
export function addFocusCheck(p: PatientData, focusId: string, day: Day, status: 'done' | 'partial' | 'not_done', obstacle?: string) {
  p.focusChecks = p.focusChecks.filter((c) => !(c.focusId === focusId && c.day === day));
  p.focusChecks.push({ id: nextId('fc'), focusId, day, status, obstacle });
}
export function setConsent(p: PatientData, scope: Scope, value: boolean) {
  p.consents = { ...p.consents, [scope]: value };
}
export function setEdgeStatus(p: PatientData, edgeId: string, status: EpistemicStatus) {
  p.edges = p.edges.map((e) => (e.id === edgeId ? { ...e, status } : e));
}
export function addAgenda(p: PatientData, text: string, day: Day, shared: boolean) {
  p.agenda.push({ id: nextId('ag'), text, status: 'open', day, shared });
}
export function addJournal(p: PatientData, text: string, day: Day, visibility: Visibility) {
  p.journal.push({ id: nextId('j'), text, day, visibility });
}
export function slug(label: string): string {
  return 'n_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
}
export function addMoment(
  p: PatientData,
  input: { day: Day; situation: string; thought: string; emotion: string; intensity: number; behavior: string; visibility: Visibility; tools: string[] },
): Moment {
  const raw: Array<{ label: string; kind: MapNode['kind'] }> = [
    { label: input.situation, kind: 'situation' },
    { label: input.thought, kind: 'thought' },
    { label: input.emotion, kind: 'emotion' },
    { label: input.behavior, kind: 'behavior' },
  ];
  const parts = raw.filter((x) => x.label.trim().length > 0);
  const chain: string[] = [];
  for (const part of parts) {
    const id = slug(part.label);
    if (!p.nodes.some((n) => n.id === id)) p.nodes.push({ id, label: part.label.trim().slice(0, 60), kind: part.kind });
    chain.push(id);
  }
  const m: Moment = {
    id: nextId('m'),
    day: input.day,
    visibility: input.visibility,
    situation: input.situation.slice(0, 120),
    thought: input.thought.slice(0, 200),
    emotion: input.emotion.slice(0, 60),
    intensity: input.intensity,
    behavior: input.behavior.slice(0, 120),
    chain,
    tools: input.tools,
  };
  p.moments.push(m);
  for (const t of input.tools) p.toolUses.push({ toolId: t, day: input.day });
  return m;
}
export function addRecap(patientId: string, day: Day, text: string) {
  const s = getStore();
  const list = s.recaps.get(patientId) ?? [];
  list.push({ day, text });
  s.recaps.set(patientId, list);
}

// ---- Slice 1 mutations (callers MUST have authorized and validated already) ----
export function addSignalTo(p: PatientData, signal: Signal) {
  p.signals.push(signal);
}
export function setSignalActive(p: PatientData, id: string, active: boolean) {
  p.signals = p.signals.map((s) => (s.id === id ? { ...s, active } : s));
}
export function addFocusTo(p: PatientData, draft: FocusDraft, createdBy: 'clinician' | 'patient'): FocusItem {
  const item: FocusItem = { id: nextId('f'), createdBy, status: 'active', ...draft };
  p.focusItems.push(item);
  return item;
}
export function setNextSession(p: PatientData, day: Day, today: Day) {
  p.sessions = p.sessions.filter((s) => s.occurred || s.day < today);
  p.sessions.push({ id: nextId('s'), day, occurred: false });
}
export function markSessionOccurred(p: PatientData, id: string) {
  p.sessions = p.sessions.map((s) => (s.id === id ? { ...s, occurred: true } : s));
}
export function setAgendaStatus(p: PatientData, id: string, status: 'open' | 'done') {
  p.agenda = p.agenda.map((a) => (a.id === id ? { ...a, status } : a));
}
export function setAgendaShared(p: PatientData, id: string, shared: boolean) {
  p.agenda = p.agenda.map((a) => (a.id === id ? { ...a, shared } : a));
}
export function addNodeTo(p: PatientData, node: MapNode) {
  p.nodes.push(node);
}
export function addEdgeTo(p: PatientData, e: { from: string; to: string; relation: Relation }, status: EpistemicStatus) {
  p.edges.push({ id: nextId('e'), from: e.from, to: e.to, relation: e.relation, status, visibleToPatient: true });
}
export function setTimezone(p: PatientData, tz: string): boolean {
  if (!isValidTimezone(tz)) return false;
  p.timezone = tz;
  return true;
}
/** Onboarding: consents are exactly what the person chose (default off), signals only from the offered list. */
export function completeOnboarding(p: PatientData, signalIds: string[], consents: Partial<Record<Scope, boolean>>, tz?: string): { ok: boolean; error?: string } {
  const chosen = [...new Set(signalIds)].filter((id) => SIGNAL_SUGGESTIONS.some((s) => s.id === id));
  if (chosen.length > MAX_ACTIVE_SIGNALS) return { ok: false, error: 'Too many signals.' };
  for (const id of chosen) {
    if (p.signals.some((s) => s.id === id)) continue;
    const sug = SIGNAL_SUGGESTIONS.find((s) => s.id === id)!;
    const { why: _why, ...rest } = sug;
    p.signals.push({ ...rest, shared: false, active: true });
  }
  const next = { ...p.consents };
  for (const k of Object.keys(next) as Scope[]) next[k] = consents[k] === true;
  p.consents = next;
  if (tz && isValidTimezone(tz)) p.timezone = tz;
  p.onboarded = true;
  return { ok: true };
}

// ---- Goals, assessments ----
export function addGoalTo(p: PatientData, draft: FocusDraft): FocusItem {
  const item: FocusItem = { id: nextId('g'), createdBy: 'patient', status: 'active', ...draft };
  p.focusItems.push(item);
  return item;
}
export function updateFocus(p: PatientData, id: string, fn: (f: FocusItem) => FocusItem) {
  p.focusItems = p.focusItems.map((f) => (f.id === id ? fn(f) : f));
}
export function addAssessmentTo(p: PatientData, a: Assessment) {
  p.assessments.push(a);
}
