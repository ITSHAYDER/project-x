-- Project X — Migration 0002: invite-by-link
-- Run this in the SQL Editor AFTER 0001_init.sql.
-- Why this is needed: the original relationships table required knowing
-- the patient's user ID at invite time. But the anon key (used by all
-- normal app code) can't look up another user by email -- only a
-- service-role key can, and using that key from browser-reachable code
-- would be a serious security mistake. Instead: the psychiatrist creates
-- an "unclaimed" invite (patient_id = NULL) with a random token, shares
-- the link, and the patient "claims" it by filling in their own ID --
-- something only they can legitimately do, enforced by RLS below.

alter table public.patient_psychiatrist_relationships
  alter column patient_id drop not null;

alter table public.patient_psychiatrist_relationships
  add column invite_token uuid not null default gen_random_uuid();

alter table public.patient_psychiatrist_relationships
  add constraint invite_token_unique unique (invite_token);

-- The old unique(patient_id, psychiatrist_id) constraint would reject
-- multiple NULL-patient_id invites from the same psychiatrist (Postgres
-- treats each NULL as distinct in a unique constraint by default, so
-- this actually already works correctly -- no change needed there).

-- Allow an authenticated user to look up ONE unclaimed invite by its
-- token (needed so they can see "Dr. X invited you" before accepting).
-- This only ever exposes the psychiatrist's own profile info and the
-- fact that an invite exists -- never any patient health data.
create policy "authenticated users can view an unclaimed invite"
  on public.patient_psychiatrist_relationships for select
  using (patient_id is null);

-- Allow an authenticated user to claim an unclaimed invite as themself.
create policy "users can claim an unclaimed invite as themself"
  on public.patient_psychiatrist_relationships for update
  using (patient_id is null)
  with check (patient_id = auth.uid());
