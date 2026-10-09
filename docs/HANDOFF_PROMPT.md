# HANDOFF PROMPT: continue "Project X: Playbook" (do not restart it)

You are taking over an existing, working prototype. **Your job is to keep it exactly as it is in spirit, and extend it.** Read this whole file, then `README.md`, `docs/CODING_AGENT_PROMPT_v3.md` (the long product spec this build came from), `docs/RLS_TEST_PLAN.md`, `docs/GO_LIVE_CHECKLIST.md`, `docs/DESIGN_NOTES.md`. Then read the code. Do not rewrite, rename, restructure or "modernize" anything that works. Add to it.

## 1. What this product is (understand this before touching code)

**Project X is a patient-owned longitudinal record, with a living case-formulation Map and a Playbook the person keeps, launched clinician-first.** A psychologist introduces it to patients. The patient owns the record; the clinician sees only what the patient has consented to share. When therapy ends, the patient keeps everything and can keep using it alone.

The idea that makes it more than a mood tracker: **a psychologist's most valuable artifact is the case formulation (a working theory of how this person's problems are connected). Today it lives in the clinician's head and is never tested against the patient's daily life.** Project X lets clinician and patient co-author that theory as a **Map**, tests it continuously against the patient's own entries, links every claim to its evidence, and hands it back to the patient as a **Playbook** (early signs, what helps, goals).

Hooks:
- Patient: "My therapy has a working theory of me, and I can watch how it holds up in my own life."
- Psychologist: "Before a session I can see what happened to the things we agreed to watch, and what my patient wants to bring, in about a minute, with evidence one tap away, with no raw-data flood and no real-time monitoring duty."

It must NEVER become: an AI therapist or companion, a chatbot, a generic mood/journal app with AI, an EHR, a scribe, a marketplace, a surveillance tool, a gamified app (no streaks, points, confetti). It does not diagnose, predict, give treatment or medication advice, or claim causation.

The next steps are listed in section 6. If you believe something in the spec would hurt the product, say so in `docs/PROGRESS.md` and do the smaller coherent thing. **Do not blindly implement the specification. Before implementing each major feature, inspect the existing architecture and determine the correct integration point. If an existing feature is poorly designed, refactor it rather than layering another feature on top. If a proposed feature does not actually improve the core product loop, do not implement it merely because it appears in this document. Prioritize product coherence over feature count.**

> **MVP update:** `APP_MODE=product` now has real sign up / log in / log out, roles, single-use invite codes, connect/disconnect, delete account, JSON-file persistence (`lib/data/persist.ts`, pilot only), plus Goals and Anxiety (with GAD-7, no severity labels). Read `docs/MVP.md`. Accounts live in `lib/auth/service.ts`; storage is still behind `lib/data/store.ts`, which is what Slice 2 replaces with Supabase. Invariants 1 to 12 still hold; add tests for anything that touches privacy. Known MVP gaps: no email (verification, reset, invites), no MFA, no CSP, in-memory rate limits, single-server storage.

> **Update:** Slice 1 below is now largely DONE in this repo (signals UI, clinician Focus editor, agenda done/share, session scheduling, onboarding, Map editing, time zones, `APP_MODE`, tour). Treat the Slice 1 list as already built; verify it, fix first-run issues, and continue from Slice 0 and Slice 2. Smaller per-slice prompts are in `docs/slices/` (paste ONE at a time). Two ways to run the product: `docs/TWO_VERSIONS.md`.

## 2. What exists (inventory)

Next.js 14 App Router + TypeScript + Tailwind. Demo mode on an in-memory store with **synthetic** data. Node 22.6+.

```
lib/domain/   PURE engine, no framework imports (the product's brain)
  types.ts                 domain types (Signal, Moment, MapNode/Edge, FocusItem, Consents, Viewer, Statement...)
  dates.ts stats.ts        helpers (days are 'YYYY-MM-DD' strings)
  insights/config.ts       EVERY threshold lives here
  insights/series.ts       one value per day; windows
  insights/baseline.ts     personal baseline (trailing 28d excl. last 7), shift detection, week comparison, readyOn
  insights/pairs.ts        pre-declared pair evidence (rate when A in state vs other days)
  insights/scope.ts        scopeFor(data, viewer): viewer-scoped data. THE PRIVACY BOUNDARY
  insights/brief.ts        computeBrief(): typed statements + coverage + "not enough data" notes
  insights/evidence.ts     source ids -> human-readable lines (only resolves ids in scoped data)
  map/chains.ts            chain-edge evidence from Moments, trend, proposeEdges
  map/interventions.ts     pre/post (14d before vs after)
  map/summaries.ts         edgeSummaries(): per-edge text, evidence, display status ("observed" computed at read time)
  playbook/earlySigns.ts   harder periods + retrospective lead signs
  playbook/whatHelps.ts    tool evidence vs one pre-declared outcome
  playbook/summary.ts      Playbook view (early signs + what helps), consent-gated for clinicians
  today/scheduler.ts       deterministic ask list (windows, cap 3, fatigue, quiet, session modes)
  today/contextLine.ts     template-based context line (NO LLM)
  safety/crisis.ts         deterministic crisis keyword screen (NO LLM, ever)
  ai/verifier.ts           deterministic verifier for any AI-worded statement
lib/data/seed.ts           deterministic SYNTHETIC patients (Alex 84 days with planted patterns, Sam day-zero, Riley no clinician)
lib/data/store.ts          in-memory store + mutations + content-free audit  <- the thing to swap for Supabase
lib/auth/demo.ts           requireActor / requirePatientSelf / requireClinicianPatientAccess  <- keep these as the authorization choke point
lib/ai/provider.ts         Gemini REST client, typed errors (AI_NOT_CONFIGURED, AI_RATE_LIMITED, AI_BLOCKED, AI_TIMEOUT, AI_BAD_OUTPUT, AI_HTTP_ERROR)
lib/ai/polish.ts           AI only re-words ALREADY-COMPUTED statements; output verified or discarded
lib/session.ts lib/validate.ts   page-level auth helpers; input validation
app/actions.ts             ALL server actions (auth -> authorize -> validate -> mutate -> audit -> redirect)
app/patient/*              today, moment, map, history, journal, you, support
app/clinician/*            today list; patients/[id] with tabs brief|map|history|journal|plan|access
app/api/export/route.ts    patient exports only their own record (never takes an id)
components/                Sparkline, StatementList, MapDiagram, Shell, Nav, ScalePrompt
supabase/migrations/0001_playbook_schema.sql   DRAFT schema + RLS, NEVER EXECUTED
tests/engine.test.ts tests/app.test.ts         35 tests (node:test)
scripts/ai-diagnose.mjs                         diagnoses the AI pipeline stage by stage
```

Verified offline before handoff: all 35 tests pass; strict typecheck of engine and server code (against stub Next types); every screen server-rendered for every persona without crashes or private-data leaks; access control (unlinked clinician -> 404, wrong role -> redirect).
**NOT verified:** `npm install`, `next build`, `next dev`, a real browser, the Supabase migration, accessibility tools. Expect small first-run fixes.

## 3. INVARIANTS: never break these (add tests before changing anything near them)

1. **Viewer-scoped computation.** Anything shown to a clinician is computed from `scopeFor(data, clinicianViewer)` and rendered from that same scoped data. Never compute from full data and filter afterward. A clinician must not see private Moments, private journal entries, private agenda items, unshared signals, patient-belief edges resting on private data, or any count/aggregate derived from them. The mutation test in `tests/engine.test.ts` ("adding a PRIVATE moment never changes what the clinician sees") must keep passing and be extended for every new feature.
2. **"Observed" is never stored.** `observed` is computed at read time from the viewer's scoped data. Stored edge statuses are: patient_belief, clinician_hypothesis, confirmed_together, proposed, dismissed.
3. **Every insight is typed and traceable.** Statement types: REPORTED (the person's own data), OBSERVED (a pattern in reported data, with the computation shown), TOPIC (a possible topic, phrased as a possibility or question; never a finding). Every statement has `sourceRefs` and a "View entries" affordance that resolves only ids present in scoped data. Wording is non-causal ("a pattern in the reported data, not a cause"). No diagnoses, no predictions, no advice, no medication talk, no "you should".
4. **Deterministic first, AI second.** All numbers, deltas, baselines, patterns come from `lib/domain`. AI may only re-word or draft; it never computes, never sees raw journal text, never sees private data when the viewer is a clinician, has no tools, and every output passes `lib/domain/ai/verifier.ts` (valid source refs, numbers preserved, banned language rejected) or is discarded. The product must remain fully useful with AI off. Patient text is untrusted data, never instructions (prompt-injection defense).
5. **Crisis handling is deterministic.** `safety/crisis.ts` + the static `/patient/support` page. No LLM in that path. Do not "improve" it with AI. A clinician must review its wording and keyword list before real use.
6. **Authorization choke point.** Every server action, route handler and page authenticates, then calls `requirePatientSelf` or `requireClinicianPatientAccess`, then validates input, then acts, then writes a **content-free** audit record. Unlinked or unknown patient ids return 404 (identical), never 403. Never accept a patient id from the client for patient-side actions. Never `select *`.
7. **Honest data states.** Never fake a chart or insight. Insufficient data is a first-class state with real progress ("6 of 10 days, ready around 12 Oct") and what it will unlock.
8. **Consent is granular and immediate.** Scopes: share_checkins, share_moments_default, share_map, share_early_signs, share_focus, allow_ai_analysis, plus per-signal and per-Moment sharing. Revocation takes effect on the next read. The patient always sees "what my clinician can see right now". Defaults are OFF.
9. **The patient owns the record.** Ending a care link removes clinician access and leaves the patient's record intact and usable (stand-alone mode, see Riley).
10. **No monitoring duty.** No real-time clinician alerts by default. The product says, to patients and clinicians, that data is not monitored live and is not for emergencies. Briefs are generated on demand and are not stored as clinical records unless a clinician explicitly saves one.
11. **Engine code style:** keep `lib/domain` free of framework imports and of non-erasable TypeScript (no enums, namespaces, parameter properties) so tests run with plain `node --test`. Relative imports inside `lib/` use `.ts` extensions. All thresholds go in `insights/config.ts`. New engine behavior needs unit tests first.
12. **No gamification, no engagement tricks.** No streaks, points, badges, guilt notifications, confetti. Notifications (when built) are opt-in, at most one per day, content-free.

## 4. Design system (keep; extend consistently)

Feeling: calm precision, like a good scientific journal crossed with a well-made notebook. Not an EHR, not a meditation app, not a card-grid SaaS dashboard, not "AI" (no sparkles, gradients, purple).
- Tokens in `app/globals.css` and `tailwind.config.ts`: warm off-white paper, ink text, one ink-teal accent, one restrained amber for "worth a look"; designed dark mode. Never red/green as the only signal.
- Type: system stacks now (neutral grotesque for UI/data with tabular numerals; serif for the person's own words and narrative lines). Self-host Inter/Geist + Source Serif 4/Newsreader when adding fonts (no runtime network fonts).
- Signature elements: **the Thread** (thin vertical line connecting open items), **statement styles** (`st-REPORTED` solid rule, `st-OBSERVED` dotted rule, `st-TOPIC` amber italic block), **baseline band** shown inline where the question is asked, **Map line semantics** (solid = seen in entries, long dashes = belief/hypothesis, dots = emerging/suggested, thickness = distinct days of evidence).
- Charts: sparklines with the person's own band, small multiples, annotations over legends, always a table alternative, no gauges, no scores as verdicts.
- Accessibility: keyboard complete, 44px targets, visible focus, no color-only meaning, reduced-motion respected. Mobile-first for patient screens (375px).
- Copy: plain, warm, precise; no exclamation marks; no jargon on patient screens; "your" voice for the patient, "the patient's" for the clinician.
- Every empty space has a reason; day-zero and sparse states teach; every list/view has loading, empty and error states.

## 5. Working method

- **Vertical slices, one at a time**: migration/schema -> domain code with tests -> authorized server action -> UI with loading/empty/error states at 375/768/1280 -> privacy/authorization tests -> screenshots -> `docs/PROGRESS.md` entry. Do not start slice N+1 until slice N is demoable. Never ship a stub, a "coming soon", or a button that does nothing; if you cannot finish it, cut it from the UI.
- Run `npm test` and `npm run typecheck` before every commit. Commit small, with clear messages.
- Extend the demo seed (`lib/data/seed.ts`) with planted patterns for any new feature so it can be demonstrated and tested. Keep seed data synthetic and clearly labeled.
- Keep `docs/PROGRESS.md`: what changed, what was verified (with evidence), what is broken, what is next. Do not claim "done" without evidence (test output, screenshots).
- Add a Playwright smoke suite early (Slice 0) that signs in as each persona and walks every screen; keep it green.
- When you change anything near privacy, add a test that would fail if the change leaked data.

## 6. What to build, in order

### Slice 0: make it run and lock it down
- `npm install`, `npm run typecheck`, `npm run build`, `npm run dev`; fix whatever breaks (expect small things: types in TSX, `.ts` import extensions under Next, server action edge cases). Do not change behavior.
- Add Playwright smoke tests for all personas/screens; add axe checks; record Lighthouse for Today and Brief.
- Add CI (typecheck, tests, build, `npm audit`, secret scan).
**Done when:** build succeeds, all tests green, Playwright walks every screen for Alex/Sam/Riley/Dr. Lee, no console errors.

### Slice 1: finish the core loop that is half-built
Gaps in the current UI (all verified missing):
- **Patient-defined signals UI**: create/edit/pause signals (label, kind, unit, higher-is-better, cadence, window, optional "why this matters to me"), max 5 active. Clinician can *suggest* a signal; patient accepts/declines.
- **Clinician Focus editor**: create hypothesis (with pre-declared pair: A state -> B state, lag 0|1, set BEFORE looking at data), experiment (start date, target signal), goal, commitment; set review date. Show the same items on the patient's Today and My Map.
- **Agenda**: mark done, edit, reorder; per-item share toggle.
- **Sessions**: clinician (or patient) can set the next session date; Today switches to before/after-session modes from real data.
- **Onboarding**: 2-minute first-run for a new patient: plain-language explanation, granular consent toggles (defaults OFF) with examples, `SharePreview`, first signals, first check-in. Day-zero Today must show clinician-seeded Focus items.
- **Map editing for patients**: add a node, connect two nodes, change the wording of a relation, mark "yes / not sure / not really" (exists), see status ladder.
- **Time zones**: "today" and the morning/evening window must use the person's time zone, not the server's.
**Done when:** a brand-new patient can be created, onboarded, and run through a full loop against a clinician with zero manual data seeding; tests added for every new mutation (authorization, validation, privacy).

### Slice 2: real backend (Supabase), without breaking the engine
- Introduce a repository interface (`PatientRepo`) that the pages/actions call; keep the in-memory demo implementation (it powers tests and the demo), add a Supabase implementation. The engine in `lib/domain` stays pure and unchanged.
- Supabase Auth replaces the demo cookie. **Keep `requireActor / requirePatientSelf / requireClinicianPatientAccess` as the choke point** (reimplement them on top of the session).
- Review, correct and **execute** `supabase/migrations/0001_playbook_schema.sql` on a local Supabase stack. Implement `docs/RLS_TEST_PLAN.md` as automated tests (pgTAP or supabase-js) and make them pass in CI. Add a mutation check (loosen one policy; a test must fail).
- Clinician reads go through `scopeFor` in application code in addition to RLS (RLS cannot express derived "observed" edge visibility).
**Done when:** the full demo flow works against local Supabase, RLS test suite is green, and the in-memory tests still pass.

### Slice 3: security and trust
- Invitations: single-use, expiring, hashed tokens, optional email binding, revocation, replay-safe acceptance in one transaction, rate limiting.
- MFA (TOTP) required for clinicians before any patient route; email confirmation ON; password policy; generic auth errors.
- CSP, rate limits on auth/invites/AI/export, dependency audit, secret scan, log redaction (assert no entry text in logs), `ALLOW_REAL_PATIENT_DATA` gate with the "Synthetic data only" banner, data export + deletion (`delete_my_data` function exists in the draft schema), ending a care link flow that preserves the patient's record.
- Work through `docs/GO_LIVE_CHECKLIST.md`; write what remains.
**Done when:** the security checklist items that are code are done and tested; a written threat-model pass is in `docs/SECURITY_REVIEW.md`.

### Slice 4: the clinician's one-minute payoff
- **Session Recap with AI drafting** (flag, default off): clinician types or dictates 30-60 seconds; the system *proposes* (a) Map additions, (b) Focus items + linked signals, (c) a plain-language take-home for the patient, (d) carry-over agenda. Nothing is saved or sent to the patient until the clinician confirms each part. Extend the verifier for proposals (only things present in the clinician's text; no diagnoses; no advice). Raw clinician text is not stored unless the clinician chooses.
- Patient sees the confirmed recap in the *after session* mode and can accept/edit/decline each proposed focus item.
**Done when:** end-to-end test with a mocked provider including unsafe-output rejection and prompt-injection text inside the clinician note.

### Slice 5: the Playbook the person keeps
- **Early Signs plans + tripwires**: promote an early sign to "My Early Signs", write a plan in the person's own words; optional content-free prompt to the person themself when a sign recurs ("This is one of your early signs. Open your plan?"). Clinician sees a tripwire event only in the next Brief and only if consented. Never a real-time alert, never a prediction.
- **Review packs** at 4 weeks, 3 months, 6 months and on demand: Map then-vs-now (add `map_versions` snapshots), focus outcomes, baseline shifts, new early signs, what-helps highlights. Deterministic; AI may only phrase.
- **Progress summary export (facts only)** for the clinician's notes/supervision: counts, dates, medians, focus outcomes, Map changes with statuses. No diagnoses, no prognosis, no AI interpretation; not stored unless saved.
- **Playbook / Graduation Kit export**: printable HTML/PDF of the Map, Early Signs + plans, What Helps, goals, and "what changed since we began". Patient-owned; matches the in-app view; mobile-friendly.
**Done when:** after a care link ends, the patient keeps and can edit the Map and Playbook, and the export contains only data they are entitled to.

### Slice 6: capture quality
- **Topics**: AI may *suggest* topic chips for a Moment/journal entry; only patient-confirmed topics are saved and used in analytics (topic recurrence >= 3 times in 30 days with "View entries").
- **Voice Moments** (flag, default off): record <= 30 s, transcribe, LLM proposes the chain fields, patient confirms/edits, audio deleted right after transcription, transcript saved only if the patient saves. Do not enable for real data until the provider arrangement is suitable (see go-live checklist).
- **Notifications**: opt-in, <= 1/day, content-free, patient-chosen time, one-tap stop.
- **Ask My History** (flag, default off, build LAST, only after the verifier and privacy tests are solid): pipeline = deterministic safety screen -> LLM *intent router* constrained to an enum (`count_mentions`, `compare_periods`, `list_topics`, `focus_progress`, `better_vs_worse_periods`, `pair_pattern`, `list_agenda_items`, `unsupported`) -> deterministic query on the patient's own data -> verified phrasing with source chips. Interpretive or diagnostic questions ("why am I like this", "do I have X") get a fixed reply: what the record can show, and "this may be worth exploring with a professional". Queries live only in a patient-only, deletable table and are never visible to clinicians. A structured answer card, not a chat.

### Slice 7: design polish and quality
- Self-host fonts; refine Today, History, Brief and Map to feel premium and calm; Map layout (stable, non-jumping), list-first view on mobile with the diagram as secondary; small-multiple History; dark-mode QA; empty/loading/error states everywhere; microcopy pass.
- axe zero serious violations on all main routes; Lighthouse mobile >= 90 on Today and Brief; screenshots before/after at 375/768/1280, light/dark in `docs/audit/screens/`.

### Slice 8: validation instrumentation and final review
- Privacy-preserving, content-free product analytics (with consent) for the metrics that matter: brief opened before sessions, check-in response rate at weeks 2/4/8, focus checks completed, clinician focus items created per week, unprompted patient use in weeks without a session.
- Run the 3-minute demo script against the seed (clinician Brief -> evidence; patient Today; before-session sharing; consent revoke; end link -> record persists) with no empty or broken screen.
- Write `docs/FINAL_REVIEW.md`: what works, what is rough, what is not built, known risks, what must be validated with real clinicians (modality fit beyond CBT/ACT/DBT; patient logging at weeks 4 and 8).

## 7. Known limits and rough edges in the current build (fix or document, do not hide)
- Demo store resets on server restart; "today" uses the server's local date and hour.
- Pair-evidence thresholds (P25/P75) are computed over the analysis window; lag semantics are "B measured `lag` days after A" (seed uses lag 0).
- Map layout is a simple deterministic column layout; the diagram needs horizontal scroll on phones.
- Early-sign detection uses the "energy" signal as the anchor if present (else the first higher-is-better signal); make the anchor patient-selectable.
- Clinician can propose edges only between nodes they can already see; patient-created Map nodes via Moments are named from free text (slugged), so near-duplicate labels create separate nodes (add merge/rename).
- `focus_checks` for experiments/commitments show only the first two focus items on Today.
- Crisis keyword list is coarse; needs clinical review and localization.
- No pagination on journal/moments; no search.
- The Supabase schema has never been executed; `moments.chain uuid[]` loses referential integrity (consider a join table).

## 8. Reporting format at the end of each slice
1. What changed (files). 2. What you verified and how (commands, test names, screenshots). 3. What is still broken or unverified. 4. Any place you deviated from this document and why. 5. What you recommend next.

Be honest. If something does not work, say so. Optimize for a product that clinicians want to introduce to their patients and that patients find genuinely useful, not for the largest feature list.
