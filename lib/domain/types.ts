// Pure domain types. Keep this file free of framework imports and of non-erasable TS syntax
// (no enums / namespaces / parameter properties) so tests can run with plain `node --test`.

export type Day = string; // 'YYYY-MM-DD' (the person's local calendar day)

export type SignalKind = 'scale_0_10' | 'hours' | 'count';
export type Window = 'morning' | 'evening' | 'any';

export interface Signal {
  id: string;
  label: string;
  kind: SignalKind;
  unit?: string;
  /** true when higher values are better for the person (e.g. energy). false for anxiety. */
  higherIsBetter: boolean;
  cadence: 'daily' | 'weekly';
  window: Window;
  shared: boolean; // patient allows clinician to see this signal
  active: boolean; // paused signals are not asked about, but their history stays
}

export interface SignalEntry {
  id: string;
  signalId: string;
  day: Day;
  value: number;
}

export type Visibility = 'private' | 'shared';

/** A structured 20-second capture. `chain` is an ordered list of Map node ids. */
export interface Moment {
  id: string;
  day: Day;
  visibility: Visibility;
  situation: string;
  thought: string;
  emotion: string;
  intensity: number; // 0-10
  behavior: string;
  chain: string[];
  tools: string[]; // tool ids tried
}

export type NodeKind =
  | 'situation'
  | 'thought'
  | 'emotion'
  | 'body'
  | 'behavior'
  | 'signal'
  | 'context'
  | 'strength'
  | 'intervention';

export interface MapNode {
  id: string;
  label: string;
  kind: NodeKind;
  signalId?: string;
}

export type EpistemicStatus =
  | 'observed'
  | 'patient_belief'
  | 'clinician_hypothesis'
  | 'confirmed_together'
  | 'proposed'
  | 'dismissed';

export type Relation = 'appears_with' | 'tends_to_follow' | 'may_maintain' | 'may_reduce' | 'blocks';

export interface MapEdge {
  id: string;
  from: string;
  to: string;
  relation: Relation;
  status: EpistemicStatus;
  visibleToPatient: boolean;
  /** For signal-to-signal edges: lag in days (B measured `lag` days after A). */
  lag?: number;
}

export interface GoalStep {
  id: string;
  text: string;
  done: boolean;
}

export interface Assessment {
  id: string;
  kind: 'gad7';
  day: Day;
  answers: number[];
  total: number;
}

export interface FocusItem {
  id: string;
  kind: 'hypothesis' | 'experiment' | 'goal' | 'commitment';
  title: string;
  startDay: Day;
  reviewDay?: Day;
  signalIds: string[];
  /** For hypotheses: pre-declared pair (A state -> B state). */
  pair?: { a: string; b: string; aState: 'low' | 'high'; bState: 'low' | 'high'; lag: 0 | 1 };
  toolId?: string;
  createdBy: 'clinician' | 'patient';
  status: 'active' | 'completed';
  /** goals: why it matters to the person, in their words */
  why?: string;
  steps?: GoalStep[];
  /** patient-made items are private unless this is true. Clinician-made items are always visible to that clinician. */
  shared?: boolean;
}

export interface FocusCheck {
  id: string;
  focusId: string;
  day: Day;
  status: 'done' | 'partial' | 'not_done';
  obstacle?: string;
}

export interface Tool {
  id: string;
  label: string;
  /** outcome signal used to judge this tool (pre-declared, one per tool) */
  outcomeSignalId: string;
}
export interface ToolUse {
  toolId: string;
  day: Day;
}

export interface Session {
  id: string;
  day: Day;
  occurred: boolean;
}
export interface AgendaItem {
  id: string;
  text: string;
  status: 'open' | 'done';
  day: Day;
  shared: boolean;
}

export interface JournalEntry {
  id: string;
  day: Day;
  text: string;
  visibility: Visibility;
}

export type Scope =
  | 'share_checkins'
  | 'share_moments_default'
  | 'share_map'
  | 'share_early_signs'
  | 'share_focus'
  | 'share_assessments'
  | 'allow_ai_analysis';

export type Consents = Record<Scope, boolean>;

export type Viewer =
  | { role: 'patient'; patientId: string }
  | { role: 'clinician'; clinicianId: string; patientId: string };

/** Everything the engine needs about one person. */
export interface PatientData {
  patientId: string;
  displayName: string;
  signals: Signal[];
  entries: SignalEntry[];
  moments: Moment[];
  nodes: MapNode[];
  edges: MapEdge[];
  focusItems: FocusItem[];
  focusChecks: FocusCheck[];
  tools: Tool[];
  toolUses: ToolUse[];
  sessions: Session[];
  agenda: AgendaItem[];
  journal: JournalEntry[];
  assessments: Assessment[];
  consents: Consents;
  linkedClinicianId: string | null;
  /** IANA time zone, e.g. 'Europe/Paris'. Decides what "today" and "morning" mean for this person. */
  timezone: string;
  onboarded: boolean;
}

export type StatementType = 'REPORTED' | 'OBSERVED' | 'TOPIC';

export interface Statement {
  id: string;
  type: StatementType;
  key: string; // template key, e.g. 'shift', 'pair', 'chain_edge'
  text: string;
  sourceRefs: string[]; // ids of entries / moments / checks used
  section: 'changed' | 'stable' | 'focus' | 'bring' | 'topics' | 'map' | 'measures';
}

export interface Insufficient {
  status: 'insufficient';
  have: number;
  need: number;
  unlocks: string;
  /** best estimate of the day this becomes possible, if the person keeps logging daily */
  readyOn?: Day;
  /** what `have` and `need` count, e.g. 'days' or 'harder periods' */
  unit?: string;
}
