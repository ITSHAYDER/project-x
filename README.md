# Project X — Playbook (prototype)

A patient-owned longitudinal record with a living case-formulation **Map** and a **Playbook** (early signs, what helps), launched clinician-first. The patient owns the record; a clinician sees only what the patient has consented to share.

> **Synthetic demo only.** Not a medical device. Does not diagnose, predict or give treatment advice. Not monitored in real time. Not for emergencies. Do not put real patient data in it (see `docs/GO_LIVE_CHECKLIST.md`).

## Run it

Requires Node 22.6+.

```bash
npm install
cp .env.example .env.local      # optional; the product works without AI
npm run dev                     # showcase at http://localhost:3000
```

Two ways to run it (`APP_MODE`, see `docs/TWO_VERSIONS.md`): **showcase** (default; synthetic personas, guided tour at `/tour`, presenter notes) for investors, psychologists and clinics, and **product** (the MVP: real sign up and log in, invite codes, Goals, Anxiety with GAD-7; JSON-file storage for pilots). **Start with `docs/MVP.md`.**

To view the actual account pages, start product mode with `npm run dev:product`, then open `/login` or `/signup`. In the default showcase mode those paths redirect to the persona demo on the home page.

On the home page take the 3-minute tour or pick a persona:

| Persona | What it shows |
|---|---|
| **Alex** (patient) | 12 weeks of data. A planted formulation: recurring chain, sleep→anxiety pattern, wind-down experiment, a "walk" that tends to go with better days, early signs, a session in 2 days |
| **Sam** (patient) | Day six. Honest "still learning your usual" states; clinician-seeded focus item; most sharing off |
| **Riley** (patient) | No clinician. The record works on its own (standalone) |
| **Jordan** (patient) | Brand new: onboarding, nothing shared until chosen, clinician-seeded focus on day zero |
| **Dr. Lee** (clinician) | Today list, pre-session **Brief** with evidence one tap away, **Map**, shared journal, recap, access log. Sees only what each patient shares |

Try this: as Alex open *You*, switch **Share my Map** off, then switch to Dr. Lee and see the Map and its statements disappear. Log a private Moment as Alex and confirm it never appears for Dr. Lee.

## Tests

```bash
npm test          # 60 tests; needs only Node (uses node:test), no install
npm run typecheck # needs `npm install`
npm run build
npx playwright install chromium
npm run test:e2e  # persona smoke tests + serious/critical axe checks against the built app
npm run ai:diagnose
```

`npm test` covers the deterministic engine (baseline, shift, pair evidence, chain edges, early signs, what-helps, scheduler), **privacy scoping** (including a mutation test: adding a private Moment never changes what the clinician sees), authorization helpers, the AI verifier, the AI pipeline against a mocked provider (blocked, rate-limited, bad JSON, unsafe output, number changes, prompt-injection text never sent), and the crisis screen.

## What is real, what is not

**Implemented and tested**
- Pure TypeScript engine in `lib/domain/` with every threshold in one file (`insights/config.ts`).
- Viewer-scoped computation: clinician output is computed only from consented, shared data. "Observed" is computed at read time and never stored.
- Statement types (REPORTED / OBSERVED / TOPIC) with "view entries" evidence on every statement; honest "not enough data yet" states with real progress.
- Adaptive Today scheduler (windows, cap of 3, fatigue rule, quiet mode, session modes) and a template-based context line (no LLM).
- Moments (20-second chain capture) that build the Map; patient responds "yes / not sure / not really" to each link; clinician can propose or agree.
- Early Signs (retrospective), What Helps, pre/post for experiments, pre-declared pair evidence.
- Consent controls with a live "what my clinician can see right now" preview, per-Moment sharing, content-free audit, JSON export.
- Deterministic crisis screen with a static support page (no AI in that path).
- AI: Gemini client with typed errors; **AI only re-words already-computed statements**, never sees journal text or private data, and every output is verified (numbers preserved, no diagnostic/causal/directive/medication/prediction language, sources valid) or discarded.
- Security headers, server-side validation on every action, authorization on every action and page (unlinked clinician → 404).

**Verified in the build environment:** the domain and app-layer logic (tests above) and server-rendering of every screen for every persona (no crashes, no private-data leaks, correct access control).
**NOT verified:** `npm install`, `next build`, `next dev`, a real browser, and the Supabase migration. They could not be run offline. Expect to fix small things on first run (run `npm run typecheck` first).

**Added in the latest pass (Slice 1):** patient-defined signals (add, pause, resume, max 5 active), onboarding with granular consent (all off by default), time zones ("today" and "morning" follow the person), clinician Focus editor (hypothesis with a pair declared up front, experiment, commitment, goal), next-session scheduling that drives before/after-session modes, agenda done/share, patient Map editing (new things and links, always starting as the person's own belief), showcase guided tour and presenter notes, `APP_MODE` switch.

**Not built (on purpose or not yet)**
- Supabase wiring: the app uses an in-memory demo store (`lib/data/store.ts`). The schema is in `supabase/migrations/0001_playbook_schema.sql` and is **untested**. See `docs/RLS_TEST_PLAN.md`.
- Real authentication, invitations, MFA, rate limiting, email confirmation.
- AI-drafted session recaps, voice Moments, Ask-My-History, review packs, Graduation Kit/PDF export, notifications, wearables.
- Per-signal baselines on mobile charts beyond sparklines; a real design pass; accessibility audit (axe/Lighthouse not run).

## Layout

```
lib/domain/   pure engine (insights, map, playbook, today, safety, ai/verifier)  ← the product's brain
lib/data/     seed (synthetic) + in-memory store                                  ← swap for Supabase
lib/auth/     authorization functions (single choke point)                        ← keep when you add real auth
lib/ai/       Gemini provider + verified polish pipeline
app/          Next.js App Router screens and server actions
supabase/     draft schema + RLS (untested)
docs/         RLS plan, go-live checklist, full coding-agent prompt (v3)
scripts/      ai-diagnose.mjs
tests/        node:test suites
```

## If the AI "does not work"

Run `npm run ai:diagnose`. It checks, in order: key present, key accepted, configured model exists for that key (model names get retired), and a test generation returns JSON. In the app, failures become typed errors (`AI_NOT_CONFIGURED`, `AI_RATE_LIMITED`, `AI_BLOCKED`, `AI_TIMEOUT`, `AI_BAD_OUTPUT`, `AI_HTTP_ERROR`) with plain messages, and the product keeps working without AI.

## Next steps (suggested order)
1. `npm install && npm run typecheck && npm run dev`, fix first-run issues.
2. Show it to 5–10 clinicians before building more. The riskiest assumptions are clinician fit and patient logging at weeks 4 and 8.
3. Wire Supabase Auth + the schema; write the RLS tests first.
4. Then, in order: invitations/MFA, session recap drafting, review packs, Playbook export.
