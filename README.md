# Project X — Full MVP Loop

Auth, roles, the complete patient check-in/journal/discussion/timeline loop,
resumable self-reflection assessment, evidence-based insights, and personal
data export,
the psychiatrist patient list + profile view, invite-by-link, and an
AI-generated "since your last review" summary — all built on the free tiers
of Supabase and Vercel.

## If you already have Milestone 1 running

You need to redo three things before this version will work:

1. **Run the three new migration files**, in order, in the Supabase SQL
   Editor: `0002_invitations.sql`, `0003_ai_and_audit_policies.sql`,
   `0004_readable_psychiatrist_profiles.sql`, and `0005_assessments.sql`.
   (`0001_init.sql` is unchanged
   — don't re-run it.)
2. **Run `npm install` again** — `package.json` now includes `zod`, which
   your existing `node_modules` doesn't have yet.
3. **Add one new environment variable** to `.env.local` if you want AI
   summaries to work: `GEMINI_API_KEY` (see step 4 below). Everything
   else works without it.

## Fresh setup, from zero

### 1. Create your Supabase project

Same as before: https://supabase.com → **New project** → wait for it to
provision → **SQL Editor** → **New query**.

Run these five files **in this exact order**, each as its own query:
1. `database/migrations/0001_init.sql`
2. `database/migrations/0002_invitations.sql`
3. `database/migrations/0003_ai_and_audit_policies.sql`
4. `database/migrations/0004_readable_psychiatrist_profiles.sql`
5. `database/migrations/0005_assessments.sql`

Each should say "Success. No rows returned." Running them out of order will
fail, since 0002-0005 alter or reference things earlier migrations create.

Then: **Project Settings → API** → copy the **Project URL** and **anon
public** key.

Also recommended for local testing: **Authentication → Providers → Email**
→ turn off "Confirm email" (Supabase's free tier rate-limits confirmation
emails aggressively; turning this off avoids hitting that limit while
testing with multiple accounts).

### 2. Get a free Gemini API key (only needed for AI summaries)

Go to https://aistudio.google.com/apikey, sign in with a Google account,
create a key. No payment method required for the free tier. Everything
in the app except the "Generate summary" button works without this.

### 3. Install and configure

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=
GEMINI_API_KEY=your-gemini-key-or-leave-blank
```

### 4. Run it

```bash
npm run dev
```

Open http://localhost:3000.

## Testing the full loop

1. Sign up as a **psychiatrist** (e.g. `doc@test.com`).
2. On the psychiatrist dashboard, click **Invite a patient** — copy the
   link it shows you.
3. Open that link in a private/incognito window (so you're not still
   logged in as the psychiatrist). Sign up as a **patient** with a
   different email — you'll land back on the invite page automatically
   and can accept it.
4. As the patient: complete today's check-in, write a journal entry (try
   sharing one, leaving another private), add something to "things to
   discuss."
5. Back in the psychiatrist window: refresh the dashboard, click into
   your patient, and confirm you see the mood trend, the discussion item,
   and the *shared* journal entry only (not the private one).
6. Click **Generate summary** (requires `GEMINI_API_KEY` to be set) and
   confirm a structured, labeled AI summary appears.

## Deploying to Vercel (free)

```bash
git add .
git commit -m "Full MVP loop: check-ins, journal, discussions, timeline, invites, AI summary"
git push
```

In Vercel: **Project Settings → Environment Variables** → add all four
variables from `.env.local` (yes, including `GEMINI_API_KEY` if you're
using it — Vercel's environment variables are private to your project,
not exposed to visitors). Redeploy after adding them if you'd already
deployed before. Set `NEXT_PUBLIC_SITE_URL` to your real
`https://project-x-yourname.vercel.app` URL so invite links generated in
production show the correct domain.

## What's still NOT built (deliberately)

Appointments as a real scheduling feature, medication as its own
structured table, granular per-field consent, MFA, self-service data
export/deletion, and everything in the marketplace/payments/telemedicine
category. See `docs/ARCHITECTURE.md` Section J for the full list — these
are intentionally deferred, not forgotten.

## Before any real patient's data touches this

This is still a synthetic-data prototype. Before a real pilot: re-read
`docs/ARCHITECTURE.md` Section 14 (regulation/legal risk) and Section 34
(access-control testing) — an actual security/privacy review by someone
qualified should happen before anyone but you and test accounts use it.

