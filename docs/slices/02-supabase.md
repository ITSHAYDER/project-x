# Slice 2: real backend (paste this alone, after Slice 0)

Read `docs/HANDOFF_PROMPT.md` sections 1 to 3 and `docs/TWO_VERSIONS.md`, `docs/RLS_TEST_PLAN.md`.

Goal: `APP_MODE=product` works against Supabase, without changing the engine in `lib/domain` or the screens' behavior. Showcase mode keeps working on the in-memory store.

1. Introduce a repository interface that `lib/data/store.ts` currently implements in memory (read/write of `PatientData` and the mutations used by `app/actions.ts`). Keep the in-memory implementation for tests and showcase. Add a Supabase implementation.
2. Replace the demo cookie sign-in with Supabase Auth in product mode. Keep `requireActor`, `requirePatientSelf`, `requireClinicianPatientAccess` as the only authorization choke point, reimplemented on the real session. Unlinked clinician stays 404.
3. Review and run `supabase/migrations/0001_playbook_schema.sql` on a local Supabase stack; fix it. Implement every assertion in `docs/RLS_TEST_PLAN.md` as an automated test and make them pass in CI. Add a mutation check (loosen one policy and see a test fail).
4. Every clinician read still goes through `scopeFor` in application code.
5. Update `app/page.tsx` so product mode shows a real sign-in instead of "not configured".

Done when: the full flow (patient onboarding, check-in, Moment, clinician Brief, consent revoke, end link) works in product mode against local Supabase; RLS tests green; the 60 existing tests still pass.
