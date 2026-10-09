# The MVP: what it is, how to run it, what it is NOT

## Run the real thing (product mode)

```bash
npm install
cp .env.example .env.local
# edit .env.local:  APP_MODE=product   and   CLINICIAN_SIGNUP_CODE=<a secret you invent>
npm run build && npm run start:product      # or: npm run dev:product
```

1. Open the site. **Sign up as a clinician** at `/signup` using your `CLINICIAN_SIGNUP_CODE`.
2. On your Today page press **Invite a patient**. Give the code (e.g. `K7P2-9XQM`) to the patient. It works once and expires in 7 days.
3. The patient signs up at `/signup` (optionally entering the code) or connects later under **You → Your clinician**. They go through onboarding. **Nothing is shared until they switch it on.**
4. The patient uses Today, Goals, Anxiety, My Map, History, Journal. You open their **Brief**.

Showcase mode (`APP_MODE=showcase`, the default) is the synthetic demo for investors and clinics. See `docs/TWO_VERSIONS.md`.

## What the MVP includes
- **Real accounts**: sign up, log in, log out. Passwords hashed with scrypt, session tokens stored only as hashes, 7-day sessions, login lockout after repeated failures, sign-up rate limit, generic login errors, password policy, delete-my-account.
- **Roles**: patient and clinician. Clinician sign-up needs your access code. A clinician can open only patients connected to them (anyone else gets a 404). Patients own their record; disconnecting stops clinician access immediately and keeps everything.
- **Invite codes**: single-use, expiring, hashed at rest, rate limited.
- **Goals**: own goals with a reason, target date and small steps; progress; private by default; share per goal; clinician-made goals shown as "agreed with".
- **Anxiety**: 0 to 10 evening check-in against your own usual; what changed; situations logged on your higher-anxiety days (counts only); what tends to go with calmer days; **GAD-7** questionnaire with total and change, no severity label, no diagnosis. Shared only if the patient switches on "Share my questionnaire results".
- Everything from the showcase: Today, Moments, Map, Playbook, History, Journal, consent controls, clinician Brief with evidence, focus editor, session scheduling, onboarding, time zones.

## What the MVP is NOT (be straight with your first users)
- **Storage is a JSON file** (`.data/db.json`, mode 600). Fine for a pilot with a handful of people on a server with a persistent disk (a VPS, Fly.io or Railway volume, your own machine). **It will NOT work on Vercel or other serverless hosts** (the disk is wiped). It is not for scale, concurrency or multiple server instances. The next step is Supabase (`docs/slices/02-supabase.md`).
- **No email**: no email verification, no password reset, no email invitations. A forgotten password cannot be recovered yet (an admin would have to delete the account). Sign-up reveals whether an email is already registered.
- **No MFA, no CSP, limited rate limiting** (in memory, resets on restart). No admin screen, no backups (copy the file yourself), no audit export.
- **Not cleared for real patient data.** Work through `docs/GO_LIVE_CHECKLIST.md` (hosting and AI agreements, security review, legal and clinical review, crisis wording) before anyone real depends on it. Until then, tell pilot users plainly what it is and is not.
- The GAD-7 text is included under its published free-use terms; confirm the current terms for your use. The crisis keyword screen is coarse and needs clinical review.
- Not verified here: `npm install`, `next build`, `next dev` and a real browser. All logic and every screen were tested offline (60 tests, plus server-rendering every screen for every role).

## First-week checklist
1. `npm run typecheck && npm test && npm run build` and fix any first-run issues.
2. Run it on a machine with a persistent disk; back up `.data/db.json` daily.
3. Invite 3 clinicians, then 2 to 3 patients each. Watch whether patients keep checking in at weeks 2, 4 and 8.
