# RLS / authorization test plan (must pass before any real data)

`supabase/migrations/0001_playbook_schema.sql` was written but **never executed or tested** in the environment that produced this repo. Treat it as a draft for review.

## Fixture
Users: patient A, patient B, clinician X (active link to A), clinician Y (no link), anonymous.
A has: signals (one shared, one private), entries, Moments (shared + private), journal (shared + private), agenda (shared + private), map nodes/edges (all statuses), focus items, tools.

## Assertions (each must be an automated test, e.g. pgTAP or supabase-js against a local stack)
1. **Anonymous** reads nothing from any table (including via RPC).
2. **Y** reads zero rows of A or B in every table. **Y** cannot call `log_audit` for A.
3. **X** reads from A only: shared signals + their entries when `share_checkins` is granted; `shared` Moments, journal and agenda; clinician_hypothesis / confirmed_together edges when `share_map` is granted; focus items when `share_focus` is granted. **X never reads** private Moments, private journal, unshared signals, or patient-belief edges.
4. **Revocation is immediate**: set `consents.granted=false` for a scope, X's next read of that scope returns zero rows. Ending the link (`status='ended'`) removes all X access.
5. **X reads nothing of B**.
6. **A cannot** change own `profiles.role`; cannot insert rows with `patient_id <> auth.uid()`; cannot read B's rows; cannot create an entry for a signal owned by B.
7. **X can** insert a `clinician_hypothesis` edge only with `share_map` granted, and only `created_by_role='clinician'`. X cannot update or delete A's rows.
8. `audit_log`: UPDATE and DELETE raise; direct INSERT is denied; `log_audit` rejects mismatched actors; no content columns exist.
9. `delete_my_data()` removes only the caller's rows and leaves the audit event.
10. Role escalation: signing up with `user_metadata.role='clinician'` yields a `patient` profile (role is read from `app_metadata` only).

## Known gaps to close before use
- Derived Map evidence ("observed") is computed in application code from viewer-scoped data. Every clinician read path must go through `scopeFor` (see `lib/domain/insights/scope.ts`). Add an integration test that a private Moment never changes any clinician-facing output (a mutation test exists for the engine in `tests/engine.test.ts`).
- Invitations (hashed, expiring, single-use, email-bound tokens), MFA for clinicians, rate limiting and email confirmation are **not implemented** in this repo.
- Add indexes and verify query plans with realistic volumes.
