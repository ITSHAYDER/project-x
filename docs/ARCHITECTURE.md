# Project X — Architecture & MVP Specification (Phase 0 + Phase 1 Deliverable)

*Zero-budget constraint acknowledged throughout: every component below is free at prototype scale, and every place a free tier has a limit is flagged explicitly so it never surprises you later.*

---

## A. Executive Architecture Summary (plain language)

Project X is two thin, permission-gated views over one shared, structured record:

- A **patient** logs a 60-90-second daily check-in (mood/energy/sleep/meds/note) and can flag "I want to discuss this."
- A **psychiatrist**, only for patients who have explicitly authorized them, sees a timeline of that data and an AI-generated "since your last appointment" summary.
- Nothing the AI produces is ever treated as fact — it's a labeled, re-derivable summary sitting next to the real patient-reported data, never overwriting it.
- Every access is checked twice: once by application code, and once again by the database itself (Postgres Row Level Security), so a bug in your Next.js code can never leak Patient A's data to Patient B or an unauthorized psychiatrist. This second layer is non-negotiable for a health app and costs nothing to add if designed in from day one.

The MVP is deliberately narrow: **check-in → timeline → psychiatrist view → AI summary.** No appointments calendar, no marketplace, no payments, no mobile app. Everything else in your prompt is a real future direction, but it is explicitly deferred in `NOT_NOW.md` (Section M) so scope creep has a written boundary.

---

## B. Technology Stack

| Technology | Purpose | Why (incl. $0 justification) |
|---|---|---|
| **Next.js 14 (App Router) + TypeScript** | Full-stack framework | One deployable app, not two (frontend+backend). Server Components let you query Postgres directly from the server with zero API boilerplate for read paths, which matters a lot when you're a solo dev. TypeScript catches an entire class of bugs (wrong field names, wrong types crossing the patient/psychiatrist boundary) before runtime — critical when the data is sensitive. |
| **React** | UI library | Ships with Next.js; no separate decision needed. |
| **Tailwind CSS** | Styling | Zero runtime cost, no build-time CSS-in-JS overhead, and — importantly for a solo dev — makes it hard to accidentally build an inconsistent UI across dozens of screens. |
| **shadcn/ui** | Component library | Not an npm dependency you install — you copy accessible, unstyled Radix-based components into your own repo. This means no vendor lock-in, no version-bump breakage, and you own the code, which matters for a healthcare product you'll maintain for years. Free. |
| **Supabase (Postgres + Auth + Storage)** | Database, authentication, hosting | Free tier: 500MB database, 50,000 monthly active users, 1GB file storage, 2 free projects, unlimited API requests (rate-limited, not metered). This is a **real Postgres database**, not a proprietary NoSQL store — you get full SQL, constraints, foreign keys, transactions, and Row Level Security, which is the single most important feature for this product's authorization model. |
| **Supabase Auth** | Authentication | Built on top of Postgres (`auth.users` table), handles password hashing, email verification, password reset, and session tokens (JWT) for you. You never touch or store a raw password. Free at this scale. |
| **Zod** | Schema validation | Validates every form submission and every AI output against a strict schema before it touches the database or the UI. Free, zero infra. |
| **AI provider: Google Gemini API (free tier) or Groq API (free tier)** | AI summarization | Both offer genuinely free tiers with daily rate limits (not just a trial credit that expires) suitable for a 5-20 psychiatrist pilot. Built behind a provider-abstraction interface (Section H) so you can swap to Anthropic/OpenAI later without touching business logic. |
| **Vercel (Hobby plan)** | Deployment/hosting | Free for personal/non-commercial-scale projects, native Next.js integration, automatic preview deployments per git branch, generous enough bandwidth/build minutes for a pilot. |
| **GitHub (free, private repo)** | Version control | Private repos are free; this matters because a mental-health codebase (even without real patient data) should not be public. |
| **Vitest + Testing Library + Playwright** | Testing | All free, open-source, run in GitHub Actions' free CI minutes (2,000 min/month free for private repos). |
| **Sentry (free developer tier)** | Error monitoring | Free tier covers a solo-dev pilot's error volume; configured to **never** log patient content (Section 25/32). |

**Where a free tier has a real ceiling (write these down, revisit before each milestone):**
- Supabase free: 500MB DB (plenty for check-in/journal text at pilot scale — thousands of check-ins are kilobytes each), but only **1 paused-after-1-week-of-inactivity** project on the lowest free tier — if you go quiet for a week during a school break, the project pauses and needs a manual un-pause. Not a data-loss risk, just something to remember.
- Vercel Hobby: explicitly **for personal, non-commercial use** — fine for a pilot/demo, but re-read Vercel's terms before charging psychiatrists money on it.
- Gemini/Groq free tiers: rate-limited per minute/day, fine for 5-20 pilot psychiatrists generating a summary before each appointment, not fine for real scale — this is exactly why the AI layer must be provider-abstracted from day one (Section H), so upgrading later is a config change, not a rewrite.

---

## C. System Architecture

```
                              PROJECT X
                                  │
                 ┌────────────────┴────────────────┐
                 │                                  │
             PATIENT UI                      PSYCHIATRIST UI
        (Next.js Server + Client            (Next.js Server + Client
             Components)                          Components)
                 │                                  │
                 └───────────────┬──────────────────┘
                                 │
                     NEXT.JS SERVER LAYER
              (Server Actions + Route Handlers +
                  Server Components reading DB)
                                 │
                                 ▼
                     SERVICE LAYER (lib/services/*)
        checkins.ts | journals.ts | relationships.ts |
              discussionItems.ts | aiSummaries.ts
                                 │
                     every call passes through
                  a single "requireAccess()" helper
                                 │
                                 ▼
                        SUPABASE CLIENT
              (server-side, uses the caller's JWT —
                 never the service-role key in app code)
                                 │
                                 ▼
                  POSTGRES + ROW LEVEL SECURITY
           (the real authorization enforcement point —
             app code is a convenience layer, not the guard)
                                 │
                 ┌───────────────┼───────────────┐
                 ▼               ▼               ▼
          Core tables      Audit log table   AI summary table
        (patients, check-  (append-only,     (separate from
         ins, journals,     minimal content)  source data,
         relationships,                       never overwrites it)
         discussion items)
                                 │
                                 ▼
                      AI PROVIDER ABSTRACTION
                (lib/ai/provider.ts interface;
              Gemini/Groq adapter behind it today)
```

**Key architectural decision: modular monolith, not microservices.** One Next.js app, one Postgres database, organized internally into clear modules (`lib/services/*`). At 5-20 psychiatrists and their patients, microservices would add deployment complexity, network failure modes, and cost, for zero benefit. Revisit only past ~10,000+ active users (Section 46).

---

## D. Database Architecture (MVP Schema)

Only the tables the MVP loop actually needs. `appointments`, `medications` (as a structured table), and organization/multi-tenant tables are designed for conceptually (Section 46/47) but **not created yet** — see `NOT_NOW.md`.

```sql
-- Supabase's auth.users table already exists and handles auth.
-- Everything below is public schema, linked via auth.users.id.

create type user_role as enum ('patient', 'psychiatrist');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table public.patient_psychiatrist_relationships (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  psychiatrist_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('invited', 'active', 'revoked'))
                default 'invited',
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  unique (patient_id, psychiatrist_id)
);
-- One row per patient-psychiatrist pair, ever. Status transitions
-- (invited -> active -> revoked) are tracked with timestamps instead
-- of deleting the row, so history is never lost (Section 12/13).

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  checkin_date date not null default current_date,
  mood smallint check (mood between 1 and 5),
  energy smallint check (energy between 1 and 5),
  sleep_hours numeric(3,1),
  medication_taken boolean,
  note text,
  wants_to_discuss boolean not null default false,
  created_at timestamptz not null default now(),
  unique (patient_id, checkin_date)
);
-- One check-in per patient per day (enforced by the unique constraint,
-- not just app logic) — resubmitting the same day updates, not duplicates.

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  content text not null,
  is_shared_with_psychiatrist boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- is_shared_with_psychiatrist defaults to FALSE. Nothing is visible
-- to a psychiatrist unless the patient explicitly flips it (Section 15).

create table public.discussion_items (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  status text not null check (status in ('open', 'resolved')) default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.ai_summaries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  generated_for_psychiatrist_id uuid not null references public.profiles(id),
  period_start date not null,
  period_end date not null,
  model_identifier text not null,      -- e.g. 'gemini-1.5-flash'
  prompt_version text not null,        -- e.g. 'v1'
  output jsonb not null,               -- validated against the Zod schema in Section 23
  created_at timestamptz not null default now()
);
-- Never modifies check_ins/journal_entries. A summary is a derived,
-- timestamped artifact — always re-derivable, never authoritative.

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,                -- e.g. 'patient_record_viewed'
  target_patient_id uuid references public.profiles(id),
  metadata jsonb,                      -- IDs/counts only, never content
  created_at timestamptz not null default now()
);

-- Indexes that matter at pilot scale:
create index on public.check_ins (patient_id, checkin_date desc);
create index on public.journal_entries (patient_id, created_at desc);
create index on public.patient_psychiatrist_relationships (psychiatrist_id, status);
create index on public.discussion_items (patient_id, status);
```

**Why UUIDs:** prevents an attacker (or a curious patient) from guessing sequential IDs to enumerate other patients' records — a real, low-cost mitigation against IDOR (Section 34/51).

**Why database-enforced timestamps (`default now()`), not client-supplied ones:** a patient's device clock is untrusted input. The `checkin_date` unique constraint and audit timestamps must reflect server truth.

---

## E. Authorization Model & Permission Matrix

Authentication (Supabase Auth: "who are you") is separate from authorization ("what can you do") — the JWT tells you the user's ID; RLS policies decide what that ID can touch.

| Resource | Patient (self) | Psychiatrist (with active relationship) | Psychiatrist (no/revoked relationship) | Admin (future) |
|---|---|---|---|---|
| Own profile | Read/Write | — | — | Read (audited) |
| Own check-ins | Read/Write | Read only | No access | Read (audited) |
| Own journal entries | Read/Write (all) | Read only where `is_shared_with_psychiatrist = true` | No access | No access |
| Discussion items | Read/Write | Read | No access | No access |
| Relationship row | Read (own), can request revoke | Read (own), can accept invite | Read own history only | Full (audited) |
| AI summaries | Read (own) | Read/generate (for own active patients only) | No access | Read (audited) |
| Audit logs | No access | No access | No access | Read only |

**Enforcement is at the database, not just the app:**

```sql
alter table public.check_ins enable row level security;

create policy "patients read/write own check-ins"
  on public.check_ins for all
  using (auth.uid() = patient_id)
  with check (auth.uid() = patient_id);

create policy "psychiatrists read active patients' check-ins"
  on public.check_ins for select
  using (
    exists (
      select 1 from public.patient_psychiatrist_relationships r
      where r.patient_id = check_ins.patient_id
        and r.psychiatrist_id = auth.uid()
        and r.status = 'active'
    )
  );
```

This same pattern (a `select ... where status = 'active'` subquery against the relationship table) is repeated for every patient-owned table. **This is the load-bearing security mechanism of the whole product** — even if a bug lets a psychiatrist's browser request another patient's data, Postgres itself refuses to return it.

---

## F. Patient Flow

1. Sign up (email + password via Supabase Auth) → email verification.
2. Onboarding: pick role = patient, set display name.
3. Accept a psychiatrist's invitation (relationship row moves `invited` → `active`) — or the MVP can start with the psychiatrist inviting by email, simplest for a pilot.
4. Dashboard: "How are you doing today?" → mood/energy/sleep/medication/optional note/discussion-flag → save (upsert on `patient_id + checkin_date`).
5. Optional: write a journal entry, explicitly choosing whether to share it.
6. Optional: add a discussion item.
7. View personal timeline (chronological merge of check-ins + journal entries + discussion items, see Section 17 decision below).

## G. Psychiatrist Flow

1. Sign in.
2. Dashboard: list of active patients, sorted by "has unread discussion items" or "checked in recently" first — not alphabetical, to satisfy Principle 7 ("what changed" over "what exists").
3. Select a patient → patient profile: recent check-in trend (small charts), open discussion items, shared journal entries.
4. Click "Since your last appointment" → triggers or retrieves a cached AI summary for the period since the last generated summary (or last 30 days if none exists).
5. Review the AI summary side-by-side with a link back to the raw check-ins/journal entries it was built from.
6. Use it during the actual appointment (outside the product).

---

## H. AI Architecture

```
Psychiatrist clicks "Since your last appointment"
        │
        ▼
1. requireAccess(psychiatristId, patientId) — checks the
   patient_psychiatrist_relationships table for status='active'.
   If this fails, STOP. Nothing is sent anywhere.
        │
        ▼
2. Check ai_summaries for an existing summary covering this
   period. If one exists and no new check-ins/journal entries
   have been added since, return it — do NOT regenerate
   (Section 36, cost control).
        │
        ▼
3. Data selection: pull only check_ins, discussion_items, and
   journal_entries WHERE is_shared_with_psychiatrist = true,
   for this patient, in the target date window.
        │
        ▼
4. Normalize into a compact structured object (dates, numeric
   scores, short text fields) — never send the full raw table
   rows or any unrelated patient's data.
        │
        ▼
5. Build a structured prompt (Section 23 schema) with an
   explicit system instruction: patient text is DATA, not
   INSTRUCTIONS (Section 52, prompt injection defense).
        │
        ▼
6. Call the AI provider through lib/ai/provider.ts —
   a thin interface: generateSummary(input): Promise<AISummaryOutput>.
   Today's implementation calls Gemini/Groq; swapping providers
   later means writing one new adapter file, not touching any
   calling code.
        │
        ▼
7. Validate the raw model response against the Zod schema
   (Section 23). If it fails validation or the model returns
   something outside the expected shape, DO NOT store or show
   it — show "summary unavailable, please review the raw
   timeline" instead. Never surface an unvalidated AI response.
        │
        ▼
8. Store in ai_summaries (never touches check_ins/journal_entries).
   Log an audit_logs row: "ai_summary_generated" (no content).
        │
        ▼
9. Render, with a persistent visible banner:
   "AI-generated summary — review against the original patient
   record before relying on it."
```

**What never gets sent to the AI provider:** unshared journal entries, any other patient's data, raw account/auth info, audit logs. **Prompt injection defense (Section 52):** the system prompt explicitly frames all patient-authored text as quoted data inside a fenced block, with an instruction that nothing inside that block should be treated as a command to the model, regardless of its content or phrasing (e.g., a journal entry that says "ignore previous instructions" is just text to summarize, not something the model acts on) — this is a prompt-engineering mitigation, not a guarantee, so validation of the *output shape* (step 7) is the real backstop.

---

## I. Security Architecture — Threat Model (abbreviated)

| Threat | Impact | Mitigation | Residual risk |
|---|---|---|---|
| Patient A views Patient B's data via manipulated URL/ID | Severe (privacy breach) | RLS policies enforce at DB level regardless of app-layer bugs (Section E) | Low, if RLS policies are tested (Section 34) |
| Psychiatrist accesses a revoked/never-active patient | Severe | RLS subquery checks `status = 'active'` on every read | Low |
| Prompt injection via journal text | Medium | Data/instruction separation in prompt (Section H); output schema validation | Medium — inherent to LLMs, mitigated not eliminated |
| Stolen session/JWT | High | Supabase-managed short-lived JWTs + refresh tokens; HTTPS only (Vercel enforces this by default) | Standard web-session risk, same as any SaaS |
| SQL injection | Severe | Supabase client uses parameterized queries; no raw string-concatenated SQL anywhere in app code | Low if this rule is never violated |
| Secrets committed to Git | Severe | `.env.example` only in repo; `.env.local` gitignored; service-role key never used in client code | Depends on developer discipline — add a pre-commit secret scanner (free: `gitleaks`) |
| Compromised AI provider / data leaving jurisdiction | Medium | Only minimal, shared-flagged data sent (Section H); provider abstraction allows switching if needed | Real if you scale into GDPR territory — flag for legal review before EU users (Section 26) |

---

## J. MVP Scope

**BUILD NOW:** signup/login/roles, patient-psychiatrist invitation+relationship, daily check-in, journal entries with explicit sharing toggle, discussion items, patient timeline, psychiatrist dashboard + patient profile view, RLS on every table, basic audit logging, one AI summary feature (structured, cached, provider-abstracted).

**BUILD LATER:** appointments as a real scheduling feature, medication as its own structured table (vs. a boolean in check-ins), charts beyond simple line/bar, granular per-field consent (vs. current all-or-nothing "active relationship"), MFA, data export/deletion self-service UI, multi-psychiatrist-per-patient support in the UI (schema already supports it).

**DO NOT BUILD YET:** marketplace/discovery, payments, telemedicine/video, EHR/FHIR integration, wearable integration, mobile app, multi-language UI, organization/clinic accounts, admin role UI (a `role` value exists in the enum for future use, nothing more).

---

## K. Development Roadmap (Milestones)

1. **Repo + Supabase project + auth working** (signup/login/logout, roles, protected routes).
2. **Schema + RLS deployed**, seeded with synthetic demo data (Section 27).
3. **Patient check-in loop** end-to-end (form → save → appears in timeline).
4. **Relationship + invitation flow** (psychiatrist invites patient, patient accepts).
5. **Psychiatrist dashboard + patient profile view** (read path, RLS-gated).
6. **Discussion items + journal sharing toggle.**
7. **AI summary pipeline** (provider abstraction → Gemini/Groq → schema validation → storage → UI).
8. **Audit logging wired into every sensitive action.**
9. **Access-control test suite** (Section 34 — this is not optional, do it before any real pilot user touches the app).
10. **Deploy to Vercel + Supabase production project**, synthetic-data demo walkthrough, then (only after a privacy/legal gut-check) a real 5-psychiatrist pilot.

## L. Repository Structure

```
project-x/
├── app/
│   ├── (auth)/login/  (auth)/signup/
│   ├── patient/dashboard/  patient/timeline/  patient/journal/
│   ├── psychiatrist/dashboard/  psychiatrist/patients/[id]/
│   └── api/ai-summary/route.ts   (thin wrapper if a Route Handler is cleaner than a Server Action here)
├── components/
│   ├── ui/            (shadcn primitives)
│   ├── patient/        psychiatrist/        shared/
├── lib/
│   ├── auth/           db/ (supabase clients: server + browser)
│   ├── security/       (requireAccess helpers)
│   ├── ai/             (provider.ts interface + gemini adapter)
│   ├── validation/     (zod schemas)
│   └── services/       (checkins.ts, relationships.ts, journals.ts, discussionItems.ts, aiSummaries.ts)
├── database/
│   ├── migrations/      seed/ (synthetic demo data)
├── tests/
│   ├── unit/  integration/  e2e/  security/
├── docs/                (see Section M)
├── .env.example         .gitignore
└── package.json
```

## M. Documentation Structure (`/docs`)

`PRODUCT_VISION.md`, `MVP_SPEC.md`, `USER_FLOWS.md`, `ARCHITECTURE.md` (this doc), `DATABASE.md`, `AUTHORIZATION.md`, `SECURITY.md`, `PRIVACY.md`, `AI_SPEC.md`, `AI_SAFETY.md`, `TESTING.md`, `DEPLOYMENT.md`, `METRICS.md`, `BUSINESS_MODEL.md`, `VALIDATION.md`, and **`NOT_NOW.md`** — the last one lists every deferred feature from Section J's "later"/"not yet" columns, with one line each on why, so scope creep has to be a deliberate decision to edit this file, not an accident.

## N. Testing Strategy

- **Unit:** Zod schema validation, permission-check helper functions, AI output parsing/validation logic.
- **Integration:** signup→login, relationship invite→accept, check-in save→retrieve, full AI pipeline against a test Supabase project with seeded data.
- **E2E (Playwright):** the patient loop (signup → check-in → timeline) and the psychiatrist loop (login → patient → summary) end-to-end in a real browser.
- **Security/access-control (highest priority, Section 34):** explicit tests that Patient A cannot read Patient B's check-ins, that a revoked psychiatrist loses access immediately, that a manipulated patient ID in a request is rejected, and that these tests fail loudly (not silently pass) if RLS is ever accidentally disabled on a table.

## O. First Coding Milestone

Do not start with the AI feature or the UI polish. Start with **Milestone 1**: a working Supabase project with the schema above, RLS policies applied, Supabase Auth wired into a bare Next.js app with signup/login and a role-based redirect (`/patient/dashboard` vs `/psychiatrist/dashboard`), deployed to Vercel, with nothing in it yet but "you are logged in as [role]." This proves the entire security foundation (auth + RLS + deployment) works before a single line of product feature code is written — everything after this is UI and business logic sitting on a foundation you've already verified is sound.

When you're ready, tell me and we'll do Milestone 1 as actual file-by-file code — exact paths, complete contents, copy-pasteable commands, nothing left as an unexplained placeholder.
