-- Project X — Milestone 1 schema
-- Run this once, in full, in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste this whole file -> Run).
-- Safe to re-run only after dropping the objects it creates; it is not
-- idempotent on purpose, so you don't accidentally run it twice on a
-- database that already has data.

-- ============================================================
-- 1. ENUM + PROFILES
-- ============================================================

create type public.user_role as enum ('patient', 'psychiatrist');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null,
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- A psychiatrist needs to be able to see the display_name of patients
-- they have an ACTIVE relationship with (created after the
-- relationships table below, so this policy is added at the bottom
-- of this file once that table exists).

-- ============================================================
-- 2. AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
-- Supabase Auth manages auth.users itself. We never insert into it
-- directly. Instead, a trigger copies the role/display_name that the
-- client passed in at sign-up time (auth.signUp's `options.data`)
-- into our own profiles table the instant the user is created.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    (new.raw_user_meta_data ->> 'role')::public.user_role,
    coalesce(new.raw_user_meta_data ->> 'display_name', 'New User')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 3. PATIENT <-> PSYCHIATRIST RELATIONSHIPS
-- ============================================================

create table public.patient_psychiatrist_relationships (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  psychiatrist_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'invited'
    check (status in ('invited', 'active', 'revoked')),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  unique (patient_id, psychiatrist_id)
);

alter table public.patient_psychiatrist_relationships enable row level security;

create index on public.patient_psychiatrist_relationships (psychiatrist_id, status);
create index on public.patient_psychiatrist_relationships (patient_id, status);

create policy "patients see their own relationships"
  on public.patient_psychiatrist_relationships for select
  using (auth.uid() = patient_id);

create policy "psychiatrists see their own relationships"
  on public.patient_psychiatrist_relationships for select
  using (auth.uid() = psychiatrist_id);

create policy "psychiatrists can invite a patient"
  on public.patient_psychiatrist_relationships for insert
  with check (auth.uid() = psychiatrist_id);

create policy "patients can accept or revoke their own relationship"
  on public.patient_psychiatrist_relationships for update
  using (auth.uid() = patient_id);

-- Now that this table exists, add the policy that lets a psychiatrist
-- read the display_name of patients they have an ACTIVE relationship with.
create policy "psychiatrists can read active patients' profile"
  on public.profiles for select
  using (
    exists (
      select 1 from public.patient_psychiatrist_relationships r
      where r.patient_id = profiles.id
        and r.psychiatrist_id = auth.uid()
        and r.status = 'active'
    )
  );

-- ============================================================
-- 4. CHECK-INS
-- ============================================================

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

alter table public.check_ins enable row level security;
create index on public.check_ins (patient_id, checkin_date desc);

create policy "patients manage their own check-ins"
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

-- ============================================================
-- 5. JOURNAL ENTRIES (private by default)
-- ============================================================

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  content text not null,
  is_shared_with_psychiatrist boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.journal_entries enable row level security;
create index on public.journal_entries (patient_id, created_at desc);

create policy "patients manage their own journal entries"
  on public.journal_entries for all
  using (auth.uid() = patient_id)
  with check (auth.uid() = patient_id);

create policy "psychiatrists read only shared journal entries"
  on public.journal_entries for select
  using (
    is_shared_with_psychiatrist = true
    and exists (
      select 1 from public.patient_psychiatrist_relationships r
      where r.patient_id = journal_entries.patient_id
        and r.psychiatrist_id = auth.uid()
        and r.status = 'active'
    )
  );

-- ============================================================
-- 6. DISCUSSION ITEMS
-- ============================================================

create table public.discussion_items (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.discussion_items enable row level security;
create index on public.discussion_items (patient_id, status);

create policy "patients manage their own discussion items"
  on public.discussion_items for all
  using (auth.uid() = patient_id)
  with check (auth.uid() = patient_id);

create policy "psychiatrists read active patients' discussion items"
  on public.discussion_items for select
  using (
    exists (
      select 1 from public.patient_psychiatrist_relationships r
      where r.patient_id = discussion_items.patient_id
        and r.psychiatrist_id = auth.uid()
        and r.status = 'active'
    )
  );

-- ============================================================
-- 7. AI SUMMARIES (built in Milestone 3+, table created now
--    so the schema is stable from day one)
-- ============================================================

create table public.ai_summaries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  generated_for_psychiatrist_id uuid not null references public.profiles(id),
  period_start date not null,
  period_end date not null,
  model_identifier text not null,
  prompt_version text not null,
  output jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.ai_summaries enable row level security;

create policy "patients read their own ai summaries"
  on public.ai_summaries for select
  using (auth.uid() = patient_id);

create policy "psychiatrists read summaries generated for them"
  on public.ai_summaries for select
  using (auth.uid() = generated_for_psychiatrist_id);

-- Only server-side code using the service-role key should INSERT here
-- (never the browser), so no insert policy is granted to any client role.

-- ============================================================
-- 8. AUDIT LOGS
-- ============================================================

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  target_patient_id uuid references public.profiles(id),
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

-- No select/insert/update/delete policies are created for any client
-- role on purpose: audit logs are written only by trusted server-side
-- code (service-role key, which bypasses RLS by design) and are not
-- readable by patients or psychiatrists through the app at all yet.
