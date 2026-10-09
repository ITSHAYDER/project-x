# PROJECT X — CODING AGENT PROMPT v3 (supersedes v2 where they conflict)

**How to read this file.** PART 0 (below) is a breakthrough update. It **takes precedence** over everything after it. The rest of the file is the v2 prompt (operating rules, phases 1–10, acceptance criteria) and still applies unless PART 0 changes it. Where v2 says "Focus" is one of three core capabilities, PART 0 replaces that: **the Map is the core; Focus items become interventions placed on the Map.**

---

# PART 0 — BREAKTHROUGH UPDATE

## 0.1 Why v2 was not enough
v2 made the product coherent but conservative: check-ins, focus items and a change engine. That is a better tracker, not a reason to exist. The strongest unmet need is not "more data between sessions." It is this:

> **A psychologist's most valuable artifact is the case formulation: a working theory of how this person's problems are connected and maintained. It lives in the clinician's head or on paper, is never tested against the patient's daily life, and is not something the patient can see, hold or keep.**

Research on person-specific ("idiographic") networks and bottom-up case formulation points the same way: it is argued to be a strong route to personalised therapy, case conceptualization is described as having low reliability between therapists, and data-derived personal networks are best used to *generate questions for a dialogue between therapist and patient*, not conclusions. Paper-and-pencil versions of such networks were rated feasible and useful by both therapists and patients in a small study. There is early work on using LLMs to draft such networks from therapy sessions as a human-in-the-loop tool. We found no mainstream product that lets a clinician and patient co-author such a map, continuously test it against the patient's own daily data with source-linked evidence, and let the patient keep it. That is the opening. (Treat all of this as hypothesis to validate with clinicians; the evidence base is early and does not prove outcome benefit.)

## 0.2 The breakthrough: the Living Map and the Playbook

**The Living Map** is a co-authored, evidence-annotated diagram of how *this* person's situations, thoughts, feelings, body signals, behaviors and signals connect, and where interventions sit. It updates as the person logs their life.

**The Playbook** is what the person keeps: the Map, their **Early Signs**, **What Helps** and their goals. It is a patient-owned artifact that is useful during therapy, at the end of therapy and with no clinician at all. This is how the "self-understanding without a psychologist" idea is delivered *without* a chatbot and without becoming a generic consumer app: the independent value is the person's own tested understanding of themselves.

### Epistemic status ladder (the core trust mechanism; show it everywhere)
Every node and edge carries one of:
- `observed` — computed from the person's own entries (with counts and `[View entries]`).
- `patient_belief` — the person says it is true for them; not (yet) seen in data.
- `clinician_hypothesis` — proposed by the clinician; not (yet) confirmed.
- `confirmed_together` — patient and clinician both confirmed it.
Plus `proposed` (suggested by AI draft or engine, awaiting a human) and `dismissed`. **Observed never means causal.** Edge wording is human-chosen and non-causal by default ("often appears with", "tends to follow"); a human may assert "maintains/leads to" as a *belief or hypothesis*, never as `observed`.

### What the user sees (the 2-minute demo)
1. A clinician opens the patient's **Map**: six to ten nodes, e.g. *Conflict at work → "I'm failing" → shame/anxiety → avoid/withdraw → poor sleep → low patience next day*. Edge thickness shows number of distinct days of evidence. Dashed edges are beliefs/hypotheses with no data yet.
2. Tap an edge: "Seen 9 times on 7 days since 3 Sept. Rate last 4 weeks vs previous 4: more often." `[View entries]` shows only consented entries.
3. The clinician drags **"wind-down routine"** onto the *poor sleep* node. The Map shows: "Since 10 Sept: sleep median 6.9h vs 5.8h before (14 days each); next-day anxiety lower on 9 of 12 comparable days."
4. The **Brief** says what strengthened, weakened or emerged on the Map since the last session.
5. The patient's **My Map** shows the same picture in their own words, with "Yes, that's me / Not really / Not sure" on every proposed link, and a **Playbook** with Early Signs and What Helps.

## 0.3 New and changed capabilities (grouped; build in the order in 0.8)

### A. Moments: 20-second structured capture (replaces "mood check" as the main capture)
A Moment is a short chain: **What was happening?** (situation topic chips + optional words) → **What went through your mind?** (short text) → **What did you feel?** (emotion chips + intensity 0–10) → **What did you do?** (behavior chips) → optional **body**, **how long**, **what I tried**. Everything optional after the first step. Each Moment has `visibility` private/shared (default private; per-moment toggle; a consent setting "share new moments with my clinician by default" is available and off by default).
- **Voice option (flag `VOICE_MOMENTS`, default off):** record up to 30 s, transcribe, an LLM proposes the chain fields, **the patient confirms/edits before saving**, audio is deleted immediately after transcription by default, transcript stored only if the patient saves it. Requires a provider setup appropriate for sensitive data before real use; document in `GO_LIVE_CHECKLIST.md`.
- Chips are patient-owned vocabulary (`topics`), seeded with common suggestions; AI may *suggest* chips, only confirmed ones are saved.

### B. Map engine and editor
- Nodes: `situation | thought | emotion | body | behavior | signal | context | strength | intervention`. Edges carry `relation` (`appears_with | tends_to_follow | may_maintain | may_reduce | blocks`), `lag_days`, `epistemic_status`, `visible_to_patient` (default true), `evidence_cache`.
- **Edge evidence (deterministic, in `lib/domain/map/`)**:
  - *Chain edges*: A→B counted when a Moment contains both with A before B in the chain; count distinct days. `emerging` at 2 days, `observed` at ≥3 distinct days spanning ≥2 weeks. Show "N times on M days since DATE". Trend: last 4 weeks vs previous 4 weeks as **rates per logged Moment**, shown only if each period has ≥6 Moments.
  - *Signal edges*: for edges whose endpoints are signals, use the pre-declared-pair evidence from v2 Phase 5 (≥10 paired days; low/high at baseline P25/P75; both rates shown).
  - *Intervention edges*: pre/post windows (14 days before vs after start, ≥6 entries each) on the targeted signal, plus "days with vs without" for ad-hoc tags; counts and direction only.
  - Edge language and numbers come from templates; the LLM never computes.
- **Editor (clinician and patient)**: add node, add edge, change relation wording, set status; clinician-created items start as `clinician_hypothesis`, patient-created as `patient_belief`; when the other party agrees → `confirmed_together`. Everything is versioned (`map_versions` snapshots on each session end / weekly) so a **Map review** can show then-vs-now.
- **Layout**: automatic, stable layout (force-directed or layered with fixed seeds so the diagram does not jump between visits); manual nudge persists. Mobile: list-first view of "chains" with a pinch-zoom diagram as secondary.
- **Insufficient data** is a designed state: nodes/edges from beliefs show as dashed with "no entries yet — N more Moments would let us look."

### C. Session Recap: the clinician's one-minute payoff
After a session the clinician types or dictates 30–60 seconds. The system drafts, **for clinician confirmation only**: (1) Map additions/changes, (2) Focus items/experiments and linked signals, (3) a plain-language take-home recap for the patient (3–5 lines), (4) carry-over agenda for next time. Nothing is saved or sent to the patient until the clinician confirms each part. The patient sees the confirmed recap in the *After your session* mode of Today and can accept/edit/decline each proposed focus item.

### D. Playbook (patient-owned; useful with or without a clinician)
1. **Early Signs** (retrospective lead patterns; never prediction). Patient chooses an anchor signal. "Harder period" = anchor below the person's baseline P25 for ≥3 consecutive days (constants documented). For each period, look at the 7 days before onset: which other signals/topics shifted beyond baseline? Output example: "Before 3 of 4 harder periods, your sleep dropped about 4–6 days earlier." Minimum: ≥2 periods and ≥56 days of data; <3 periods is labelled "tentative." The person (and optionally clinician) can promote an item to **My Early Signs**, and attach a **plan** in their own words ("If this happens: …"). **Tripwires**: a promoted sign can trigger a *content-free* gentle prompt to the person themself ("This is one of your early signs. Open your plan?"). Clinician sees a tripwire event only in the next Brief and only if the patient consented; never a real-time alert. Copy states plainly: this is not a prediction and not monitoring.
2. **What Helps**: patients tag "things I tried" (from clinician focus items, a personal toolbox, or free chips) at Moments or check-ins. For each tool, compare **one predeclared outcome** (e.g., intensity at the next entry, or next-day anxiety) after use vs after comparable occasions without it, with counts: "After 'walk', next-evening anxiety was below your usual 8 of 12 times; on days without: 5 of 14." Strictly pattern language; ≥6 uses to show a comparison; otherwise "Not enough uses yet" with a progress counter. Ranked toolbox; the person can pin favorites.
3. **My Goals** (existing goals) attached to Map nodes.
4. **Graduation Kit / Playbook export**: a printable, patient-owned PDF (and in-app view) containing the Map, Early Signs with plans, What Helps toolbox, goals and a short "what changed since we began" summary. It is offered by the clinician at therapy end, or by the patient at any time. After a care link ends, the Playbook continues in standalone mode (own signals, Moments, Map editing, Early Signs, What Helps) with no clinician features.

### E. Review packs and the progress summary
- **Reviews at 4 weeks, 3 months, 6 months, and on demand**: a shared view (to clinician only per consent) showing Map then-vs-now, focus outcomes, baseline shifts, new Early Signs, What Helps highlights. Generated deterministically; AI only phrases.
- **Progress summary export (facts only)** for the clinician's own notes/supervision/payer paperwork: counts, dates, signal medians, focus outcomes, Map changes with statuses. No diagnoses, no prognosis language, no AI interpretation. Not stored as part of any record unless the clinician saves it.

### F. Supporting features (smaller, in service of the above)
- **Bring-this cards**: before a session, Moments, agenda items and changed edges can be dragged into the patient's agenda; the patient decides what is shared. Replaces a passive "things to discuss" list.
- **Send-this-insight**: patient can send any observed edge/pattern (with selected evidence) to the clinician as a snapshot.
- **Life events and periods**: simple timeline anchors (job change, exam, conflict, illness) usable as context nodes and as markers in History and the Map.
- **Coverage/data-quality indicator** on every clinician-facing insight ("based on 14 of 20 expected days").
- **Quiet mode**: patient pauses prompts for N days without penalty; the scheduler stops asking, History is unaffected.
- **Clinician-visible vs private distinction everywhere**: a lock icon and plain label on every item.

## 0.4 Revised information architecture
- **Patient:** Today · **My Map** (Map, Playbook: Early Signs, What Helps, goals, Focus experiments) · History (timeline, what changed, patterns) · Journal (journal, Moments) · You (privacy & sharing preview, care team, signals, reminders, export, delete). *Focus* is no longer its own tab: focus items live on the Map as interventions and on Today as the daily check.
- **Clinician:** Today · Patient (opens on **Brief**; tabs: Brief · **Map** · History · Shared journal · Sessions & plan (includes Session Recap) · Access log) · Practice.

## 0.5 Today changes
Today still follows v2 §3.1 but the capture step now includes a **Moment button** ("Something happened"), the focus check shows which Map node/edge the item targets, and the *Since last time* statement can be a Map change ("The link between *work conflict* and *poor sleep* appeared on 3 more days this month").

## 0.6 Data model additions (new migrations only)
- `map_nodes`, `map_edges`, `map_versions` as above; `map_edge_evidence` cache keyed by (edge, viewer_scope_hash, data_version).
- `moments(id, patient_id, occurred_at, visibility, situation_text, thought_text, emotion_intensity null, body_text, duration_minutes null, tried_tool_ids[], created_via ['typed','voice'])`; `moment_topics(moment_id, topic_id, role ['situation','emotion','behavior','body'], origin)`.
- `tools(id, patient_id, label, origin ['clinician_focus','patient'], focus_item_id null, pinned)`; `tool_uses(tool_id, moment_id null, signal_entry_id null, used_at)`.
- `early_signs(id, patient_id, anchor_signal_id, definition jsonb, status ['proposed','tentative','promoted','dismissed'], plan_text null, tripwire_enabled, share_with_clinician)`; `tripwire_events(id, early_sign_id, fired_at)` (content-free).
- `session_recaps(id, session_id, clinician_text_ref null, confirmed_parts jsonb, patient_recap_text, confirmed_at)` (store the clinician's raw text only if the clinician chooses; default: do not store).
- `consents` scopes added: `share_moments` (per-moment + default), `share_map`, `share_early_signs`, `allow_voice_processing`.
- All new tables: RLS on, explicit per-operation policies, patient-owned rows, clinician access only through active link + scope; clinician-visible reads go through viewer-scoped functions.

## 0.7 Safety and privacy rules specific to the Map and Playbook
1. **Derived-data rule**: clinician-visible edge evidence is computed from shared Moments/entries only. An edge based mostly on private data appears to the clinician only with the patient's chosen status (e.g., `patient_belief`), with no counts, unless the patient sends the insight.
2. **No causal or diagnostic language** in any map, early-sign, or what-helps output; the verifier enforces it (see 0.9).
3. **Status honesty**: UI text must preserve the status ladder ("You and Dr. Lee think…" vs "Your entries show…").
4. **Early Signs are retrospective patterns** the person chose to watch. No risk scores, no predictions, no automatic clinician alerts, no real-time monitoring. Onboarding text for patients and clinicians states this.
5. **Crisis handling stays deterministic**: configured high-risk Moment content or instrument items → static supportive message and resources immediately; no LLM in that path; the tripwire feature never replaces it.
6. **Clinician transparency**: Map items are visible to the patient by default (collaborative formulation). Provide a per-item `visible_to_patient` switch for clinicians, default on, and document the tradeoff in `docs/PRODUCT_DECISIONS.md`.
7. **Data minimization/subpoena awareness**: Briefs, Reviews and recaps are generated on demand, not stored as clinical records by default; saving is an explicit clinician action; retention controls and a documented deletion path exist.

## 0.8 Build order (vertical slices; do not start slice N+1 until N passes its acceptance criteria and is demoed)
- **S0** AI audit, diagnosis and fix (v2 Phase 1). Security audit.
- **S1** IA, design tokens/components, new migrations, expanded demo seed (0.10).
- **S2** Today + Moments (typed chain capture), topics, scheduler, privacy toggles.
- **S3** Map core: nodes/edges, status ladder, chain-edge evidence, patient and clinician editors, `SharePreview`.
- **S4** Clinician Brief + Session Recap (without voice).
- **S5** Signal edges, pair evidence, interventions on the Map, What Changed.
- **S6** Playbook: What Helps, Early Signs, tripwires, goals on Map.
- **S7** Review packs, progress summary export, Graduation Kit/Playbook export, standalone mode after link end.
- **S8** AI layer: drafting (recap, topics), verifier hardening, injection suite; voice Moments behind flag; Ask My History behind flag (last, optional).
- **S9** Formal security/privacy gate (continuous checks happen in every slice): RLS matrix, MFA, headers, rate limits, lifecycle.
- **S10** Design polish, accessibility, performance, testing completion, final review (v2 Phase 10).
Every slice ends with: migration → domain code with unit tests → authorized server action → UI with loading/empty/error states at 375/768/1280 → RLS/authorization tests → screenshots → `docs/PROGRESS.md` entry. If a slice cannot be finished, cut its scope and say so; never ship a stub.

## 0.9 Verifier additions
Reject any generated statement that: asserts a Map edge as `observed` without a computed evidence reference; upgrades a belief/hypothesis to fact; uses causal verbs about edges ("causes", "leads to", "because") unless quoted as a human-authored belief with its status; names a diagnosis or condition; predicts future episodes ("you will", "likely to relapse"); gives advice on medication or treatment; or includes second-person directives ("you should"). Tests must cover each rule.

## 0.10 Demo seed additions (`npm run seed:demo`)
For Patient A add: ~60 Moments forming a recurring chain (*work conflict → "I'm failing" → shame/anxiety → avoid → poor sleep*) plus two weaker chains; 4 "harder periods" where sleep drops 4–6 days earlier in 3 of 4; a "walk" tool with planted benefit (next-evening anxiety lower on most uses); a "wind-down routine" intervention with a measurable pre/post sleep change; a Map with mixed statuses (observed, patient_belief, clinician_hypothesis, confirmed_together, proposed); one session recap; 12 weeks of map versions. Include adversarial text inside a Moment (prompt injection) and a crisis-keyword Moment to test the deterministic path. Patient B (6 days, day-zero), Patient C (no link, standalone) as in v2, with at least a small Map to demonstrate the standalone Playbook.

## 0.11 Additional acceptance criteria (in addition to v2's)
- On Patient A, the engine finds the planted chain edge, the planted Early Sign (3 of 4 periods), the planted What-Helps benefit, and the intervention pre/post change; returns `insufficient` states for Patient B.
- A clinician-viewer never sees counts or existence of evidence derived from private Moments (mutation test: add a private Moment; clinician output unchanged).
- The 2-minute demo script in 0.2 runs on seeded data without a single empty or broken screen.
- The Playbook export contains only the patient's own consented-to-export data, matches the in-app view, and renders on mobile.
- After a care link ends: clinician access is gone immediately; patient keeps Map, Playbook, signals and Moments and can continue.

---
# END OF PART 0 — v2 BODY FOLLOWS
---

# PROJECT X — CODING AGENT PROMPT v2 (replaces the previous prompt)

You are a senior full-stack engineer, product designer and security engineer working in `ITSHAYDER/project-x` (Next.js App Router, TypeScript, Tailwind, Supabase with RLS, Zod, Gemini, Vercel).

A previous agent run produced partial changes and left the product feeling empty, with a purposeless home page, a weak daily experience and AI features that do not work. Your job is not to add more features. Your job is to make **one coherent product loop work end-to-end, with real data, for both users**, and to prove it.

## OPERATING RULES (read twice)

1. **Do not blindly implement the specification.** Before implementing each major feature, inspect the existing architecture and determine the correct integration point. If an existing feature is poorly designed, refactor it rather than layering another feature on top. If a proposed feature does not actually improve the core product loop, do not implement it merely because it appears in this specification. Prioritize product coherence over feature count.
2. **Vertical slices only.** Build each slice end-to-end (migration → domain logic → authorized server action → UI with loading/empty/error states → tests) and demo it before starting the next. Never leave a half-built route, a placeholder page, a "coming soon", lorem ipsum, or a button that does nothing. If something cannot be finished, remove it from the navigation.
3. **No empty product.** Every screen must have a designed *day-zero state that teaches or gives something useful*, and must look excellent with 84 days of data. Both states are acceptance criteria.
4. **Evidence over claims.** Do not say "done" without proof: command output, test results, screenshots at 375/768/1280 px. Write progress to `docs/PROGRESS.md` after every slice (what changed, what was verified, what is broken, what is next).
5. **Preserve what works** (auth, invite acceptance, RLS foundations, private/shared journal semantics, audit table). Inspect `git log` to see what the previous run changed; keep what is good, repair what is half-done, delete what is dead.
6. **Never** log, print, commit or expose secrets or patient content. Synthetic data only; show a visible "Synthetic data only" banner unless `ALLOW_REAL_PATIENT_DATA=true`.
7. **Clinical boundaries are product requirements**: no diagnosis, no prediction of diagnoses, no causal claims, no treatment or medication advice, no AI therapist, no free-form emotional chatbot.

---

## PRODUCT THESIS (build to this)

**Project X is a patient-owned longitudinal record, with an optional, consent-scoped clinician lens.** It launches **clinician-first** (psychologists introduce it to their patients) but the data model, privacy model and patient experience are built so the record remains valuable and fully usable when there is no active clinician link.

```
PERSON'S EXPERIENCE → PATIENT-OWNED RECORD → SELF-UNDERSTANDING (always)
                                          → CLINICIAN LENS (only what the patient has consented to)
```

The hook, for each user:
- **Patient:** "My therapy has a working theory about me, and I can watch how it holds up in my own life. Everything I record helps me see what has actually been happening."
- **Psychologist:** "Before a session I can see what happened to the things we agreed to watch, and what my patient wants to bring, in about a minute, with evidence one tap away. And it doesn't flood me with raw data or add to my records unless I choose."

The three things that make this product (everything else is secondary or removed):

1. **Focus** (the living formulation). A *Focus item* is something the clinician and patient agree to watch or try: a hypothesis ("when I sleep less than 6h, my anxiety is higher next day"), an experiment ("wind-down routine, 10 days"), a goal, or a commitment. A Focus item links to 1–3 **patient-defined signals** and, for hypotheses, to a pre-declared **pair** of signals. This gives the clinician authored content on day 0 (so the patient's first screen is never empty) and gives the data a purpose.
2. **Today**, the adaptive daily loop (30–60 seconds, not a mood form).
3. **What Changed**, the deterministic, source-linked change engine against the person's *own* baseline, rendered as a patient-facing history view and a clinician-facing pre-session brief.

Not part of the product now: Ask-My-History chat (built last, behind a flag, extractive only), AI companion, meditation, gamification, streaks, scheduling integrations, billing, marketplace, scribe, EHR features, wearables.

**Privacy rule that governs derived data:** any insight shown to a clinician may only be computed from inputs the clinician is already allowed to see. A patient may explicitly *send* a specific insight to the clinician, which stores a snapshot with the evidence the patient selected. Private entries never leak into clinician-visible computations, even as aggregate numbers.

---

## VOCABULARY (use consistently in code, UI and docs)

- **Signal**: something a person tracks (patient-defined). Kinds: `scale_0_10`, `yes_no`, `count`, `duration_minutes`, `text_short`.
- **Entry**: one value of a signal at a time.
- **Moment**: a 5-second quick capture ("something shifted") with optional note and tags.
- **Journal entry**: free text; `private` by default; optional `shared`.
- **Topic**: a patient-owned tag on a journal entry or moment (e.g., "sleep trouble", "work conflict"). AI may *suggest* topics; only patient-confirmed topics feed analytics.
- **Focus item**: hypothesis | experiment | goal | commitment.
- **Session**: scheduled/occurred appointment. **Agenda item**: something to discuss.
- **Baseline**: the person's own rolling reference for a signal.
- **Statement types** (everywhere insights appear): `REPORTED` (the person's own data, verbatim or counted), `OBSERVED` (system-derived pattern, with the computation shown), `TOPIC` (possible topic to explore; never a finding).

---

## PHASE 1 — AUDIT (read-only except diagnostics)

**Objectives:** know exactly what exists, what is broken, and why the AI does not work.

1. Read the whole repo: README, `docs/`, `app/`, `components/`, `lib/`, `middleware.ts`, `next.config.mjs`, `package.json`, `.env.example`, all of `database/migrations/`, and `git log -p` for the last run's changes.
2. Write `docs/AUDIT.md`: inventory (routes, actions, components, tables, policies, functions), authorization matrix per table × role (patient owner, linked clinician, unlinked clinician, other patient, anonymous), UX critique with screenshots of every route at 375/768/1280 px, tech debt, what is claimed in README but not implemented, keep/change/delete list.
3. **Diagnose the AI end-to-end** and write `docs/AI_DIAGNOSIS.md`. Do not assume it works because a button exists. Add a dev-only script `scripts/ai-diagnose.ts` (and a dev-only route guarded by `NODE_ENV !== 'production'`) that tests each stage and prints PASS/FAIL with the failing reason:
   - UI: is the button wired to the action? Does it show errors or swallow them?
   - Server action/route: reachable, authenticated, authorized, correct Supabase client (server client with cookies), runtime (node vs edge), `maxDuration` (Vercel default timeouts) — set explicit `maxDuration`.
   - Env: `GEMINI_API_KEY` present at *runtime* on the server (not `NEXT_PUBLIC_`), present in the correct Vercel environment, redeployed after being added.
   - Data retrieval: does the query return rows under the *user's* RLS context? An empty prompt (RLS silently returns zero rows) is a very likely cause of "useless" or failing output. Log row counts only, never content.
   - Provider call: key validity; **model name still valid** (call the provider's list-models endpoint and compare with the configured model; model deprecations are a common cause); HTTP status handling for 400/401/403/404/429/503; quota/rate limits; free-tier or regional restrictions.
   - Response handling: empty candidates, **safety-blocked responses** (mental-health text commonly triggers blocks: handle `promptFeedback.blockReason` and `finishReason: SAFETY`), non-JSON output, schema mismatches.
   - Persistence: do inserts of generated summaries pass the RLS policies from migration 0003? Do audit inserts succeed?
   - Rendering: does the UI handle null/partial output?
   Fix every defect found. Make the model name, provider and safety settings configurable via validated env (`lib/env.ts`). Typed error codes (`AI_NOT_CONFIGURED`, `AI_RATE_LIMITED`, `AI_BLOCKED`, `AI_TIMEOUT`, `AI_BAD_OUTPUT`, `NO_DATA`) mapped to specific, human UI messages. **The app must remain fully useful with AI disabled.**
4. Security audit (findings with severity and fixes): IDOR on every action/route taking IDs; RLS gaps; private-journal leakage in every query/view/join/AI input/export; role self-assignment at sign-up; invite token handling (hashing, expiry, single use, email binding, replay, rate limits); server actions treated as public endpoints; middleware coverage; service-role key exposure; logging of sensitive data; AI prompt injection; unsafe rendering of AI/patient text; headers/CSP; email confirmation off; no MFA.

**Acceptance criteria**
- `docs/AUDIT.md` and `docs/AI_DIAGNOSIS.md` exist, with file/line references and a root cause for every AI failure.
- `scripts/ai-diagnose.ts` runs and reports each stage. The AI summary path works end-to-end on synthetic data (or fails with a precise, correct, user-facing error if no key is configured).
- A Critical/High findings summary is written to `docs/PROGRESS.md`. Fix Critical findings immediately (before Phase 2), others in Phase 7.

---

## PHASE 2 — PRODUCT / UX FOUNDATION

**Objectives:** the right information architecture, the data model for Focus and Today, a design system, and a demo dataset so nothing is built against emptiness.

### 2.1 Information architecture (replace the current navigation; remove pages that do not fit)

**Patient app (mobile-first, bottom nav on phone, left rail on desktop):**
1. **Today**: the home. The only screen most days.
2. **History**: the personal timeline, "What changed," and evidence-linked patterns (merges Journey, Insights, Patterns).
3. **Focus**: active Focus items, their signals, progress, review dates (merges Goals).
4. **Journal**: private by default; topics; moments.
5. **You** (avatar menu): Privacy & sharing (live "what my clinician can see right now" preview), care team (links/consents), signals management, reminders, export, delete.

"Sessions" is **not a tab**: session preparation and follow-up are *modes of Today* (see 3.1). "Ask My History" is a later entry point inside History, behind a flag.

**Clinician app:**
1. **Today**: sessions today/this week; per patient: one line + at most one flag; quiet by default.
2. **Patient** (opens on **Brief**): tabs `Brief` · `History` · `Focus` · `Shared journal` · `Sessions & plan` · `Access log`.
3. **Practice**: invites, profile, MFA, AI settings (what AI may analyze; defaults off).

### 2.2 Database groundwork (new migrations only; never edit applied ones; RLS on every table; `created_at/updated_at`; indexes on FKs)

Adapt to existing tables after Phase 1. Required concepts:
- `care_links(patient_id, clinician_id, status, started_at, ended_at)`; **the patient owns the record**; clinician access = active link + consent scope. When a link ends, the record stays with the patient and clinician access stops immediately.
- `consents(patient_id, care_link_id, scope, granted, version, granted_at, revoked_at)`; scopes: `share_checkins`, `share_signals` (per-signal granularity via `signal_shares`), `share_focus`, `share_journal_selected` (per-entry), `share_assessments`, `allow_ai_analysis`. Defaults OFF except focus items authored with the clinician. `consent_text_versions` retains wording.
- `signals`, `signal_entries`, `moments`, `topics`, `entry_topics(entry_id, topic_id, origin ['patient','ai_suggested_confirmed'])`.
- `focus_items(id, patient_id, care_link_id null, kind, title, description, status, started_at, review_at, created_by_role)`, `focus_signal_links(focus_id, signal_id, role ['predictor','outcome','context'])`, `focus_pairs(focus_id, signal_a, signal_b, lag_days 0|1, expected_direction null)` (pre-declared pairs), `focus_checks(focus_id, recorded_at, status ['done','partial','not_done'], obstacle_tag null, note null)`.
- `sessions(id, care_link_id, scheduled_at, occurred_at null, created_by)`; reuse existing discussion items as `agenda_items(session_id null, text, status, created_at)`.
- `shared_insights(id, patient_id, care_link_id, snapshot jsonb, evidence_refs jsonb, sent_at)`: patient-sent snapshots only.
- `briefs`, `brief_statements`, `ai_requests` (content-free metadata), `ask_history` (patient-only, deletable), `audit_log` (append-only, content-free).
- Keep existing role semantics but generalize `psychiatrist` to `clinician` with `specialty` and optional `can_prescribe` (medication events are out of scope in this phase).

### 2.3 Design system (tokens + components; migrate screens as you touch them)

- **Feeling:** calm precision. A good scientific journal crossed with a very well-made notebook. Not an EHR, not a meditation app, not a card-grid dashboard, not "AI" (no sparkles/gradients/purple).
- **Type:** neutral grotesque with tabular numerals for UI/data (Inter or Geist); humanist serif (Source Serif 4 or Newsreader) for the person's own words and narrative lines. Scale 12/14/16/18/22/28/36. Prose 60–72ch. Mobile body 16px.
- **Color (light + designed dark):** warm off-white background, ink text, one deep ink-teal accent, one restrained amber for "worth a look." Never red/green as the only signal. WCAG AA throughout. Visible focus rings.
- **Signature elements:** (a) **the Thread**, a thin vertical line on the left of Today and History connecting open items (focus, agenda, session) so the product feels like a continuing story; (b) **statement styling**: `REPORTED` solid ink + source chip; `OBSERVED` dotted underline on the computed phrase + "how this was computed"; `TOPIC` in an indented block labelled "Possible topic — not a finding."
- **Charts:** inline sparklines with the personal-baseline band shown *where the question is asked*; small multiples on a shared time axis; vertical markers for sessions/focus start/life events; annotations over legends; always a table alternative; no gauges, no scores as verdicts, no streak counters.
- **Spacing/motion:** 4px grid; generous rhythm; functional motion only (150–200ms), honors reduced motion.
- **Components:** `Button`, `Field`, `Dialog`, `Tabs`, `Sparkline`, `BaselineBand`, `EventMarker`, `SourceChip`, `StatementBlock`, `ConsentToggle`, `SharePreview`, `EmptyState`, `Skeleton`, `Banner`, `Thread`. Provide a dev-only `/dev/design` page.
- **Copy rules:** plain, warm, precise; no exclamation marks; no motivational quotes; no clinical jargon on patient screens; never "you should."

### 2.4 Demo dataset (`npm run seed:demo`, dev-only, clearly synthetic)

Create: 1 clinician (MFA bypass only in dev), 2 patients. Patient A: 84 days of signals (sleep hours, anxiety 0–10, energy 0–10, one patient-defined signal), a Focus hypothesis pair (sleep → next-day anxiety, lag 1) with a **planted** co-occurrence the engine should find, an experiment ("wind-down routine") with 10 days of checks and obstacle tags, 12 sessions with agenda items, ~25 journal entries (≈40% shared, rest private, some containing sensitive-sounding synthetic text), topics, two life events, and a baseline shift in the last 10 days. Include 1 adversarial entry with prompt-injection text. Patient B: 6 days of data (to exercise the "learning your baseline" state). Patient C: no active clinician link (standalone state).

**Acceptance criteria**
- `docs/PROGRESS.md` lists the final IA and what was removed from the old navigation, with justification.
- Migrations apply on a fresh DB and on a DB with the old schema + data; no data loss.
- Design tokens and components exist; `/dev/design` shows all states; axe: zero serious violations.
- `seed:demo` produces data that makes every future screen non-empty, and also provides the day-zero (Patient B) and standalone (Patient C) states.

---

## PHASE 3 — PATIENT EXPERIENCE

**Objectives:** a Today screen with a clear reason to exist; a daily loop that adapts; a patient who feels understood, in control and not surveilled.

### 3.1 Today (home), specified precisely

One scrolling page, no dashboard grid. Top to bottom:

1. **Context line** (serif, 22px). Chosen deterministically from a template library by priority: (1) within 24h after a session → "From Thursday: <the focus item(s) you agreed>"; (2) session within 48h → "Thursday is coming up. 2 things you wanted to bring."; (3) a Focus review is due → "Day 10 of your wind-down experiment."; (4) a detected change exists (see 5) → "Sleep has been lower than your usual this week."; (5) default → a calm greeting plus the date. No LLM is used for this line. Every statement here is a `REPORTED` or `OBSERVED` statement with a source chip.
2. **Now** (the check-in): an *ask list* of at most 3 prompts for the current time window, produced by the deterministic scheduler (3.2). Large touch targets, one tap per signal, optional one-line note. Each answered prompt immediately reveals its sparkline with the baseline band ("here is where today sits for you"), which is the reward: information, not points.
3. **Your focus**: 1–2 active Focus items with a one-tap check (`Done` / `Partly` / `Not today`); `Not today` offers obstacle chips (tired, no time, forgot, felt too hard, didn't seem useful, other) and optional note. This feeds the `focus_checks` table.
4. **Since last time**: exactly one source-linked change statement when the engine has enough data; otherwise an honest learning state with real progress ("Learning your usual sleep: 6 of 10 entries.") and what it will unlock.
5. **Open threads** (max 3 visible, expandable): agenda items ("things to bring"), unanswered focus reviews, last moment. Inline quick-add for "Something to bring up."
6. **Done-for-now state:** when the ask list is complete, collapse to a short summary of what was captured and what comes next. No confetti, no streaks.

**Session modes** (replace a "Sessions" tab):
- *Before your session* (≤48h): top of Today becomes a preparation view: your agenda (editable, reorderable), what your clinician will see (live `SharePreview`), a "send this insight to my clinician" action on any observed pattern, and a last chance to un-share.
- *After your session* (≤24h): "What are you taking from today?" 1–3 lines from the patient; the clinician-authored Focus items appear; patient accepts, edits or declines them; one-tap commit to the next check-in time.

**Day-zero state** (new patient from an invite): Today shows the Focus item(s) the clinician seeded, 1–2 suggested signals the patient can accept/edit/decline, and a one-sentence explanation of what the first week will unlock. Never an empty screen. **Standalone state** (no active link): Today works the same with the patient's own signals and journal; the clinician-specific blocks disappear and a quiet "Connect a clinician" action exists under You. No separate onboarding, no consumer marketing copy.

### 3.2 Adaptive scheduler (`lib/domain/today/scheduler.ts`, pure and unit-tested)

Inputs: active signals + cadence + last answered, patient local time and window preferences, open focus checks, upcoming session, entries count per signal, skip history.
Rules:
- Windows: morning (default until 12:00) prioritizes sleep-type and start-of-day signals; evening prioritizes day-review and focus checks; weekly signals appear on their day or first open after; never ask a signal already answered in the window.
- Priority: signals still short of baseline minimum > focus-linked signals > others; cap 3 per window; a user-set cap is respected.
- Fatigue: if a signal is skipped 3 times in a row, show once: "Keep / change / pause this?" and reduce frequency to every other day unless kept.
- `Not today` mode: show only the focus check or nothing; never penalize or nag.
- Notifications (opt-in): at most one per day, content-free ("Your check-in is ready"), user-chosen time, one-tap stop.
Returns the ordered ask list plus a reason for each (for tests and the "why am I being asked this?" disclosure).

### 3.3 Other patient screens
- **History:** a single time axis with session markers and Focus start/end; select signals; baseline bands; "What changed" block at top; "Patterns" block listing evidence-linked observations with `[View entries]`; filters by date range; table view alternative. When data is insufficient show what is missing, not an empty chart.
- **Focus:** list of active/completed items; detail shows the signals, the checks, the planted-pair evidence when available ("On 7 of 10 days when sleep was low, anxiety was high the next day; on other days: 3 of 14"), review date, and a patient note. Patients can propose a Focus item to their clinician.
- **Journal:** write; private/shared lock icon visible and un-ambiguous; topics suggested by AI (if enabled and consented) but only confirmed topics saved; entries searchable by topic and date; moments quick-capture.
- **You → Privacy & sharing:** per-scope toggles with plain-language examples; per-signal and per-entry share controls; `SharePreview` showing exactly what the clinician sees now; content-free access history (when the clinician viewed the brief); export (JSON/PDF) and deletion request.
- **Crisis safety (deterministic, no LLM):** a discreet "Need urgent help?" on every screen leading to configurable static resources. If configured high-risk responses occur (e.g., a defined self-harm item at/above a threshold in an assessment or a safety signal), show a static supportive message and resources immediately. The product is not a monitoring or emergency service and says so in onboarding; notifications to the clinician only as the patient consented.

**Database:** `signals`, `signal_entries`, `moments`, `topics`, `entry_topics`, `focus_checks`, `agenda_items`, `sessions` from Phase 2.
**Security:** every action: authenticate → `requirePatientSelf` → Zod validate → execute → audit (content-free). Patient data is never selectable by other patients; clinician access only via `requireClinicianPatientAccess(scope)`.

**Acceptance criteria**
- A new patient (Patient B) opens Today and sees a non-empty, purposeful screen; completes onboarding + first check-in on 375px in under 2 minutes (Playwright timed test).
- With Patient A's 84 days, Today shows a context line that changes with state (verified by tests for each priority branch), at most 3 prompts, the focus check, one change statement, and open threads.
- Scheduler unit tests cover windows, caps, fatigue, session proximity and `Not today`.
- Revoking a consent removes the data from the clinician's view immediately (E2E).
- Crisis path works with the AI key unset and is tested.
- Loading/empty/error states exist for every patient screen.

---

## PHASE 4 — PSYCHOLOGIST EXPERIENCE

**Objectives:** a clinician can run their pre-session routine in about a minute and would be annoyed to lose it. The product must not add monitoring obligations or noise.

### 4.1 Today (clinician)
Sessions today/this week in time order. Each row: patient, last session, number of open agenda items, **at most one amber flag** from deterministic rules (shifted beyond baseline for ≥N days; focus check missed repeatedly; new agenda item flagged by the patient "important to bring") with a source link. No real-time alerts by default. A visible line: "Patient data is not monitored in real time" with the same text shown to patients at onboarding.

### 4.2 Patient → Brief (default tab)
A one-screen pre-session brief, generated on demand from consented data, with sections:
1. **What changed** (since last session): each item an `OBSERVED`/`REPORTED` statement with numbers and `[View entries]`.
2. **What stayed stable.**
3. **Focus**: for each Focus item: checks done/partial/not done, top obstacles, signal movement, and for pairs the pre-declared pair evidence (counts of both rates), labelled "pattern in reported data."
4. **What the patient wants to bring** (agenda items, in the patient's words, plus any shared insights the patient sent).
5. **Possible topics** (`TOPIC` blocks, max 3, phrased as possibilities).
6. **Coverage**: "12 of 14 expected check-ins this period" so the clinician can judge reliability. Categories the patient did not share show a neutral "Not shared"; no counts or hints of hidden content.
Print/copy view with sources retained. **Briefs are generated on demand and are not stored as part of any record by default**; a clinician can explicitly "Save snapshot" (stores metadata + statements) or copy to their EHR. Retention settings in Practice.

### 4.3 Focus & plan
Create/edit Focus items in under a minute from the Patient page ("After the session"): choose kind; write a plain sentence; pick or create 1–3 signals (patient must accept on their side); for a hypothesis, pre-declare the pair and lag; set a review date. AI-assisted drafting (Phase 6) proposes items from a short clinician-typed session summary, but **nothing is saved or sent to the patient without clinician confirmation.**

### 4.4 History & shared journal
Same timeline as the patient's but limited to consented scopes; only `shared` journal entries visible; topic filters limited to topics on shared entries.

### 4.5 Practice
Invites (optional email binding, expiry, revoke, status), MFA, AI controls (what AI may analyze, date range, whether to generate TOPIC prompts; default off), retention, access log of the clinician's own views.

**Database:** uses Phase 2 tables; `briefs`/`brief_statements` only when saved.
**Security:** direct URL/ID tampering returns 404; every profile open and brief generation writes a content-free audit record; clinician MFA required before any patient route.

**Acceptance criteria**
- From login to a patient's Brief in ≤3 clicks; Brief renders in <1s for Patient A (deterministic part) and degrades gracefully if AI is off.
- Every statement in the Brief has a working `[View entries]` showing only consented entries.
- Clinician dashboard with 50 synthetic patients: no N+1 queries (assert query count), <1s server time.
- Unlinked clinician and revoked-consent clinician get nothing; covered by tests.

---

## PHASE 5 — LONGITUDINAL INTELLIGENCE (deterministic core)

**Objectives:** the engine that makes the product "know" something after 3 months. Pure TypeScript in `lib/domain/insights/`, unit-tested, no LLM, viewer-scoped.

**Viewer-scoped API:** `computeInsights({ patientId, viewer: {role:'patient'}|{role:'clinician', careLinkId}, range, signals? })`. For clinicians the function reads only consented inputs. A test must assert that a clinician-viewer result equals the result computed on only the shared subset.

**Config (`config.ts`, constants, tested):**
- `BASELINE_MIN_ENTRIES = 10` across ≥14 distinct days; baseline window = trailing 28 days excluding the last 7; statistic = median with IQR (fallback MAD, fallback minimum meaningful step of 1 scale point).
- **Shift detection:** last-7-day median (≥4 entries) lies outside baseline median ± max(IQR, 1 point) **and** ≥4 of the last 7 entries are on the same side → `OBSERVED: "Sleep has been lower than your usual (median 5.5h vs usual 7h) on 5 of the last 7 days."`
- **Period comparison:** this week vs last week and this month vs previous month: median difference, counts; require ≥4 entries per side else "Not enough entries to compare yet."
- **Pre-declared pair evidence (primary pattern feature):** for each `focus_pair`, using paired days (both present, lag applied), require ≥10 pairs. Define low/high as ≤ baseline P25 / ≥ P75. Report: "On N of M days when A was low, B was high; on other days: n of m." Classification `present / weak / not seen` by rate-difference thresholds (documented constants). No p-values presented as verdicts; wording is always "pattern in your reported data," never causal.
- **Exploratory pattern mode** (patient-only by default, after ≥28 days): examines all signal pairs, labelled "Exploratory: with many comparisons, some patterns appear by chance," ranks by evidence, caps results at 3, and never auto-shares. Clinicians see an exploratory pattern only if the patient sends it.
- **Better vs worse periods:** patient picks an anchor signal; split days into top/bottom terciles of the person's own distribution (≥30 days); compare other signals' medians, topic frequency and events between groups; output counts with caveat.
- **Topic recurrence:** confirmed topics mentioned ≥3 times in 30 days; counts and `[View entries]`.
- **Focus follow-through:** done/partial/not-done counts, most common obstacle tags.
- Every output object: `{id, type: 'REPORTED'|'OBSERVED'|'TOPIC', template_key, values, source_refs[], confidence_note, computed_at}`.

**Insufficient data** is a first-class result: `{status:'insufficient', have, need, unlocksWhat}`; the UI shows real progress and what it enables.

**Caching:** compute on read from the last ~120 days; if slow, cache in `insight_runs(patient_id, viewer_scope_hash, range, data_version, result)` invalidated by data changes; never cache across viewer scopes.

**Acceptance criteria**
- ≥90% unit-test coverage on `lib/domain/insights` including sparse data, ties, timezone day-boundaries, DST, missing days, lag handling.
- On the seeded Patient A data, the engine finds the planted pair pattern, the planted baseline shift and the topic recurrence, and returns `insufficient` for Patient B.
- Viewer-scope test passes; private entries never influence any clinician-visible output (mutation test: add a private entry, clinician result unchanged).

---

## PHASE 6 — AI

**Objectives:** AI only where it adds value, always verified, always optional.

### 6.1 Roles of the LLM (and nothing else)
1. **Phrase** already-computed statements into readable prose (Brief, History).
2. **Draft Focus items and signals** from a clinician-typed session summary (clinician confirms).
3. **Suggest topics** for a journal entry (patient confirms; stored only after confirmation).
4. **Cluster shared free-text** into neutral themes with source IDs (clinician-visible only from shared entries).
5. **Ask My History** (last; behind `ASK_HISTORY` flag, default off; see 6.5).
The LLM never computes numbers, never sees private entries when the viewer is a clinician, never sees names/emails (opaque IDs), has no tools or network, and cannot take actions.

### 6.2 Provider and pipeline
`lib/ai/provider.ts` interface; Gemini implementation with configurable model; structured JSON output validated by Zod; timeouts, retry with backoff for 429/503 (max 2), safe handling of blocked/empty responses; fallback to the deterministic output (statements without prose polish) with a visible note "Summary shown without AI wording." Token and request budgets per user; rate limits.

### 6.3 Output contract
```
{ statements: [{ type: "REPORTED"|"OBSERVED"|"TOPIC", text, source_refs: [{table,id}], computed_ref?: string }] }
```
**Verifier (mandatory, deterministic):** reject and retry (≤2, then fall back) any statement that: lacks valid `source_refs` or references IDs not in the input; contains a number not in the computed values; uses diagnostic language ("has depression/bipolar/ADHD…"), causal verbs ("causes", "because of", "leads to"), prescriptive or medication language, certainty claims, or second-person directives; labels an observation as a `REPORTED` fact; or states a `TOPIC` as a finding (must be phrased as a possibility or question). Maintain the deny-list and structural rules in `lib/ai/verifier.ts` with tests.

### 6.4 Prompt-injection and data hygiene
Patient text enters prompts only as JSON-escaped data fields; the system prompt states data fields are untrusted and never instructions; schema-constrained output; no tool use; pre-filter patterns like "ignore previous instructions" and flag excluded entries ("1 entry was excluded from AI analysis"); render AI/patient text as plain text (no HTML/markdown links); strip URLs from AI output. Never store prompts or outputs containing content in logs; `ai_requests` stores only metadata (model, prompt version, token counts, outcome code).

### 6.5 Ask My History (flagged; build only after Phases 5–7 pass)
Purpose: let a person ask the questions in the strategy ("What have I been struggling with repeatedly?", "What was different when I felt better?", "What have I wanted to discuss?") **without becoming a chatbot therapist.**
- Pipeline: (1) deterministic safety screen (crisis keywords/instrument items → static crisis response, no LLM); (2) **intent router**: an LLM call constrained to an enum of supported intents + parameters (date range, signal/topic): `count_mentions`, `compare_periods`, `list_topics`, `focus_progress`, `better_vs_worse_periods`, `pair_pattern`, `list_agenda_items`, `unsupported`; validated by Zod; (3) run the matching **deterministic query** on the patient's own data; (4) LLM phrases the result under the verifier; (5) show statement types, source chips and `[View entries]`.
- `unsupported` or interpretive questions ("Why am I like this?", "Do I have X?", "Should I leave my job?") get a fixed response: what the record can show instead, plus "This may be worth exploring with a professional." No advice, no diagnosis.
- Queries and answers are stored only in `ask_history` (patient-only, deletable) and are never visible to clinicians.
- No streaming chat UI; a structured answer card with its evidence.

**Database:** `ai_requests`, `briefs`/`brief_statements`, `ask_history`, `entry_topics.origin`.

**Acceptance criteria**
- With the AI key unset, Brief and History still render deterministic content; with it set, the pipeline works end-to-end (shown in `docs/AI_DIAGNOSIS.md` re-run).
- Verifier tests reject: invented source IDs, unsupported numbers, diagnostic/causal/medication/directive language, mislabelled types.
- Injection suite passes (entries with "ignore previous instructions," "reveal other patients," "print the system prompt," markdown/link payloads, unicode tricks): no behavior change, no leakage, excluded-entry notice shown.
- Input-payload tests prove private entries and unconsented scopes never reach the model for clinician-viewer requests.
- Ask My History: for each supported intent, a golden test on Patient A's data; interpretive/diagnostic questions always return the fixed response.

---

## PHASE 7 — SECURITY / PRIVACY

Fix all Phase 1 Critical/High findings, then implement:
- **Server-side authorization everywhere:** `authenticate → authorize (role + active link + consent scope) → Zod validate → execute → audit → minimal DTO`. No `select *`. Server Actions are public endpoints and must self-authorize. RLS is defense in depth, not the only control.
- **RLS test matrix** (pgTAP or Vitest on local Supabase) with patient A, patient B, clinician X (linked to A), clinician Y (unlinked), anonymous: Y reads nothing; X reads only consented scopes of A and nothing of B; X never reads A's private entries via tables, views, joins, RPCs or the insights engine; consent revocation is immediate; role cannot be self-changed; `audit_log` rejects UPDATE/DELETE; invite tokens are hashed, expiring, single-use and email-bound.
- **Consent architecture:** versioned consent text, per-scope toggles, per-signal and per-entry sharing, immediate revocation, content-free access history visible to the patient.
- **MFA** (TOTP) required for clinicians before patient data; email confirmation on in production; password policy; generic auth errors.
- **Headers/CSP**, `Cache-Control: no-store` for authenticated responses, rate limiting for auth/invites/AI/export, dependency audit, secret scan, redacting logs, `ALLOW_REAL_PATIENT_DATA` gate and "Synthetic data only" banner.
- **Data lifecycle:** patient export; deletion that removes/anonymizes patient-owned rows and logs a content-free audit event; clinician-side retention controls for saved snapshots; ending a care link preserves the patient's record.
- **Go-live document** `docs/GO_LIVE_CHECKLIST.md`: BAAs with database/hosting/LLM providers, qualified security/privacy review, legal review of consent text and jurisdictional rules, incident response, backup/restore test, breach notification, retention/deletion policy, clinical-safety review of the crisis path. Document the subpoena/discovery reality: minimize stored derived content and make retention explicit.

**Acceptance criteria**
- Written re-test of every Critical/High finding with the test name proving it fixed.
- RLS/authorization suite runs in CI; mutation check (loosen one policy → a test fails).
- A clinician without MFA cannot reach any patient route; header tests pass; no secrets in client bundle (scan).

---

## PHASE 8 — DESIGN POLISH

- Apply the design system to every screen; remove template-like cards and decoration; make Today, History and the Brief exceptional before touching anything else.
- Every empty space has a reason: day-zero states teach; sparse-data states show real progress; error states say what happened and what to do.
- Mobile: patient flows thumb-friendly at 375px, bottom nav, safe-area insets, no horizontal scroll; clinician views work at 768px and phone.
- Accessibility: keyboard complete, correct ARIA, labels and error association, 44px targets, color not the sole signal, chart summaries for screen readers, reduced motion.
- Performance: Lighthouse mobile ≥90 on Today and Brief; self-hosted fonts; server components by default.
- Microcopy pass: consistent vocabulary; no hype; no "you should."

**Acceptance criteria**
- Before/after screenshots in `docs/audit/screens/` at 375/768/1280, light and dark.
- Axe: zero serious violations on all main routes; Lighthouse results in `docs/QUALITY.md`.
- No unstyled loading/empty/error states.

---

## PHASE 9 — TESTING

Unit (Vitest): scheduler, insights engine, verifier, authorization helpers, Zod schemas. DB/RLS matrix. Integration: every server action rejects unauthenticated, wrong-role, unlinked, revoked-consent and malformed input. E2E (Playwright): invite → accept → onboarding → day-zero Today → check-in → focus check → journal (private+shared) → pre-session mode → clinician Brief with sources → consent revoked → access gone → link ended → patient record intact (standalone state). AI evals: golden outputs for each intent, injection suite, unsafe-language suite; run when prompts change. CI: typecheck, lint, tests, build, `npm audit`, secret scan, axe on key routes.

**Acceptance criteria:** CI green from a clean checkout; coverage thresholds met (≥90% insights/authorization/verifier); all critical workflows above pass.

---

## PHASE 10 — FINAL PRODUCT REVIEW

1. **Run the 3-minute demo script** against seeded data and record screenshots/video: (a) clinician logs in (MFA), opens today's patient Brief: sees what changed, the planted pattern, focus follow-through, agenda; taps `[View entries]`; (b) patient opens Today: context line, 3 prompts, focus check, change statement; (c) patient opens Before-your-session mode and un-shares one item; (d) clinician's Brief updates; (e) patient ends the care link; the record persists in standalone mode.
2. **Product coherence review:** list every route and feature; for each, answer "Does this improve the core loop (session → focus → today → what changed → brief → session)?" Remove or hide anything that does not. Document the cut list.
3. **Honest gap report** in `docs/FINAL_REVIEW.md`: what works, what is rough, what is not built, known risks, and what must be validated with real clinicians before any real patient uses it (clinician interviews, pilot metrics to instrument: brief-open rate before sessions, check-in response rate at weeks 2/4/8, focus checks completed, clinician Focus items created per week, unprompted patient use in weeks without a session).
4. Add privacy-preserving product analytics only for those metrics (content-free event counts), with consent.

**Acceptance criteria:** the demo runs without a single empty or broken screen; `docs/FINAL_REVIEW.md` is complete and honest; no open Critical/High security issues; every feature in the product either supports the core loop or has been removed.
