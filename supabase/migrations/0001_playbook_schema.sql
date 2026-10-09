-- Project X: Playbook schema for Supabase (production counterpart of the in-memory demo store).
-- STATUS: written but NOT executed or tested in the environment that produced this zip.
-- Before any real use: run it on a fresh local Supabase, execute docs/RLS_TEST_PLAN.md, and have a
-- security reviewer read every policy. Row-level security is the coarse boundary; the fine-grained
-- viewer scoping (derived Map edges, evidence) must still be applied in application code
-- (lib/domain/insights/scope.ts) on every clinician read.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ profiles & roles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('patient', 'clinician')),
  display_name text not null default '',
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
-- Users may change only their display name. Role can never be self-assigned.
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Role comes from raw_app_meta_data (settable only with the service role), never from user metadata.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, display_name)
  values (new.id, coalesce(new.raw_app_meta_data ->> 'role', 'patient'), coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------ care links & consent
create table public.care_links (
  id uuid primary key default gen_random_uuid(),
  clinician_id uuid not null references public.profiles (id),
  patient_id uuid not null references public.profiles (id),
  status text not null default 'pending' check (status in ('pending', 'active', 'paused', 'ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index care_links_one_active on public.care_links (clinician_id, patient_id) where status = 'active';
alter table public.care_links enable row level security;
create policy care_links_select on public.care_links for select to authenticated using (patient_id = auth.uid() or clinician_id = auth.uid());
-- Only the patient can activate, pause or end a link (invites create 'pending' rows server-side).
create policy care_links_patient_update on public.care_links for update to authenticated using (patient_id = auth.uid()) with check (patient_id = auth.uid());

create table public.consents (
  care_link_id uuid not null references public.care_links (id) on delete cascade,
  patient_id uuid not null references public.profiles (id),
  scope text not null check (scope in ('share_checkins', 'share_moments_default', 'share_map', 'share_early_signs', 'share_focus', 'allow_ai_analysis')),
  granted boolean not null default false,
  version int not null default 1,
  updated_at timestamptz not null default now(),
  primary key (care_link_id, scope)
);
alter table public.consents enable row level security;
create policy consents_patient_all on public.consents for all to authenticated using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy consents_clinician_select on public.consents for select to authenticated
  using (exists (select 1 from public.care_links l where l.id = care_link_id and l.clinician_id = auth.uid() and l.status = 'active'));

-- ------------------------------------------------------------------ access helpers
create or replace function public.is_active_clinician_of(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.care_links l where l.clinician_id = auth.uid() and l.patient_id = p and l.status = 'active');
$$;

create or replace function public.has_scope(p uuid, s text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.care_links l
    join public.consents c on c.care_link_id = l.id
    where l.clinician_id = auth.uid() and l.patient_id = p and l.status = 'active' and c.scope = s and c.granted
  );
$$;

-- ------------------------------------------------------------------ signals & entries
create table public.signals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  kind text not null check (kind in ('scale_0_10', 'hours', 'count')),
  unit text,
  higher_is_better boolean not null default true,
  cadence text not null default 'daily' check (cadence in ('daily', 'weekly')),
  check_window text not null default 'any' check (check_window in ('morning', 'evening', 'any')),
  shared boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index signals_patient on public.signals (patient_id);
alter table public.signals enable row level security;
create policy signals_patient_all on public.signals for all to authenticated using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy signals_clinician_select on public.signals for select to authenticated using (shared and public.has_scope(patient_id, 'share_checkins'));

create table public.signal_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  signal_id uuid not null references public.signals (id) on delete cascade,
  day date not null,
  value numeric not null,
  created_at timestamptz not null default now(),
  unique (signal_id, day)
);
create index signal_entries_patient_day on public.signal_entries (patient_id, day);
alter table public.signal_entries enable row level security;
create policy signal_entries_patient_all on public.signal_entries for all to authenticated
  using (patient_id = auth.uid()) with check (patient_id = auth.uid() and exists (select 1 from public.signals s where s.id = signal_id and s.patient_id = auth.uid()));
create policy signal_entries_clinician_select on public.signal_entries for select to authenticated
  using (public.has_scope(patient_id, 'share_checkins') and exists (select 1 from public.signals s where s.id = signal_id and s.shared));

-- ------------------------------------------------------------------ Map and Moments
create table public.map_nodes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  kind text not null check (kind in ('situation', 'thought', 'emotion', 'body', 'behavior', 'signal', 'context', 'strength', 'intervention')),
  signal_id uuid references public.signals (id) on delete set null,
  created_at timestamptz not null default now()
);
create index map_nodes_patient on public.map_nodes (patient_id);
alter table public.map_nodes enable row level security;
create policy map_nodes_patient_all on public.map_nodes for all to authenticated using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy map_nodes_clinician_select on public.map_nodes for select to authenticated using (public.has_scope(patient_id, 'share_map'));

create table public.map_edges (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  from_node uuid not null references public.map_nodes (id) on delete cascade,
  to_node uuid not null references public.map_nodes (id) on delete cascade,
  relation text not null check (relation in ('appears_with', 'tends_to_follow', 'may_maintain', 'may_reduce', 'blocks')),
  -- 'observed' is NEVER stored: it is computed at read time from the viewer's scoped data.
  status text not null default 'proposed' check (status in ('patient_belief', 'clinician_hypothesis', 'confirmed_together', 'proposed', 'dismissed')),
  visible_to_patient boolean not null default true,
  lag smallint check (lag in (0, 1)),
  created_by_role text not null check (created_by_role in ('patient', 'clinician', 'engine')),
  created_at timestamptz not null default now(),
  unique (from_node, to_node)
);
alter table public.map_edges enable row level security;
create policy map_edges_patient_all on public.map_edges for all to authenticated using (patient_id = auth.uid()) with check (patient_id = auth.uid());
-- Conservative: the clinician row-level view is limited to clinician-authored or jointly confirmed links.
-- Links "observed" from SHARED Moments are added by the application layer (scopeFor) after computing evidence.
create policy map_edges_clinician_select on public.map_edges for select to authenticated
  using (public.has_scope(patient_id, 'share_map') and status in ('clinician_hypothesis', 'confirmed_together') and visible_to_patient);
create policy map_edges_clinician_insert on public.map_edges for insert to authenticated
  with check (created_by_role = 'clinician' and status = 'clinician_hypothesis' and public.has_scope(patient_id, 'share_map'));

create table public.moments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  visibility text not null default 'private' check (visibility in ('private', 'shared')),
  situation text not null default '' check (char_length(situation) <= 120),
  thought text not null default '' check (char_length(thought) <= 200),
  emotion text not null default '' check (char_length(emotion) <= 60),
  intensity smallint check (intensity between 0 and 10),
  behavior text not null default '' check (char_length(behavior) <= 120),
  chain uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index moments_patient_day on public.moments (patient_id, day);
alter table public.moments enable row level security;
create policy moments_patient_all on public.moments for all to authenticated using (patient_id = auth.uid()) with check (patient_id = auth.uid());
-- A clinician can only ever read Moments the patient explicitly marked shared.
create policy moments_clinician_select on public.moments for select to authenticated using (visibility = 'shared' and public.is_active_clinician_of(patient_id));

create table public.tools (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  outcome_signal_id uuid references public.signals (id) on delete set null
);
alter table public.tools enable row level security;
create policy tools_patient_all on public.tools for all to authenticated using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy tools_clinician_select on public.tools for select to authenticated using (public.has_scope(patient_id, 'share_checkins'));

create table public.tool_uses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  tool_id uuid not null references public.tools (id) on delete cascade,
  day date not null
);
alter table public.tool_uses enable row level security;
create policy tool_uses_patient_all on public.tool_uses for all to authenticated using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy tool_uses_clinician_select on public.tool_uses for select to authenticated using (public.has_scope(patient_id, 'share_checkins'));

-- ------------------------------------------------------------------ focus, sessions, agenda, journal
create table public.focus_items (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('hypothesis', 'experiment', 'goal', 'commitment')),
  title text not null check (char_length(title) between 1 and 160),
  start_day date not null default current_date,
  review_day date,
  signal_ids uuid[] not null default '{}',
  pair jsonb, -- {a, b, aState, bState, lag}: pre-declared before looking at the data
  tool_id uuid references public.tools (id) on delete set null,
  created_by_role text not null check (created_by_role in ('patient', 'clinician')),
  created_by uuid not null references public.profiles (id),
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now()
);
alter table public.focus_items enable row level security;
create policy focus_patient_all on public.focus_items for all to authenticated using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy focus_clinician_select on public.focus_items for select to authenticated using (public.has_scope(patient_id, 'share_focus') or (created_by = auth.uid() and public.is_active_clinician_of(patient_id)));
create policy focus_clinician_insert on public.focus_items for insert to authenticated
  with check (created_by = auth.uid() and created_by_role = 'clinician' and public.is_active_clinician_of(patient_id));

create table public.focus_checks (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  focus_id uuid not null references public.focus_items (id) on delete cascade,
  day date not null,
  status text not null check (status in ('done', 'partial', 'not_done')),
  obstacle text check (char_length(obstacle) <= 40),
  unique (focus_id, day)
);
alter table public.focus_checks enable row level security;
create policy focus_checks_patient_all on public.focus_checks for all to authenticated using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy focus_checks_clinician_select on public.focus_checks for select to authenticated using (public.has_scope(patient_id, 'share_focus'));

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  care_link_id uuid not null references public.care_links (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  occurred boolean not null default false
);
alter table public.sessions enable row level security;
create policy sessions_patient_select on public.sessions for select to authenticated using (patient_id = auth.uid());
create policy sessions_clinician_all on public.sessions for all to authenticated using (public.is_active_clinician_of(patient_id)) with check (public.is_active_clinician_of(patient_id));

create table public.agenda_items (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 240),
  status text not null default 'open' check (status in ('open', 'done')),
  day date not null default current_date,
  shared boolean not null default false
);
alter table public.agenda_items enable row level security;
create policy agenda_patient_all on public.agenda_items for all to authenticated using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy agenda_clinician_select on public.agenda_items for select to authenticated using (shared and public.is_active_clinician_of(patient_id));

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  day date not null default current_date,
  body text not null check (char_length(body) between 1 and 4000),
  visibility text not null default 'private' check (visibility in ('private', 'shared'))
);
alter table public.journal_entries enable row level security;
create policy journal_patient_all on public.journal_entries for all to authenticated using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy journal_clinician_select on public.journal_entries for select to authenticated using (visibility = 'shared' and public.is_active_clinician_of(patient_id));

-- ------------------------------------------------------------------ audit (append-only, content-free)
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid not null,
  actor_role text not null,
  action text not null check (char_length(action) <= 80),
  patient_id uuid not null
  -- deliberately no content column: never store entry text here
);
alter table public.audit_log enable row level security;
create policy audit_select on public.audit_log for select to authenticated using (patient_id = auth.uid() or actor_id = auth.uid());
-- No insert/update/delete policies: writes happen only through log_audit() below.
create or replace function public.audit_log_immutable() returns trigger language plpgsql as $$
begin raise exception 'audit_log is append-only'; end $$;
create trigger audit_no_update before update or delete on public.audit_log for each row execute function public.audit_log_immutable();

create or replace function public.log_audit(p_action text, p_patient uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  select role into r from public.profiles where id = auth.uid();
  if r = 'clinician' and not public.is_active_clinician_of(p_patient) then raise exception 'not linked'; end if;
  if r = 'patient' and p_patient <> auth.uid() then raise exception 'not your record'; end if;
  insert into public.audit_log (actor_id, actor_role, action, patient_id) values (auth.uid(), r, p_action, p_patient);
end $$;
revoke all on function public.log_audit(text, uuid) from public;
grant execute on function public.log_audit(text, uuid) to authenticated;

-- ------------------------------------------------------------------ patient-initiated deletion
-- Removes the caller's own rows. Ending a care link is separate: the record stays with the patient.
create or replace function public.delete_my_data() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'patient') then raise exception 'patients only'; end if;
  delete from public.moments where patient_id = auth.uid();
  delete from public.journal_entries where patient_id = auth.uid();
  delete from public.agenda_items where patient_id = auth.uid();
  delete from public.focus_checks where patient_id = auth.uid();
  delete from public.focus_items where patient_id = auth.uid();
  delete from public.tool_uses where patient_id = auth.uid();
  delete from public.tools where patient_id = auth.uid();
  delete from public.map_edges where patient_id = auth.uid();
  delete from public.map_nodes where patient_id = auth.uid();
  delete from public.signal_entries where patient_id = auth.uid();
  delete from public.signals where patient_id = auth.uid();
  insert into public.audit_log (actor_id, actor_role, action, patient_id) values (auth.uid(), 'patient', 'data.delete', auth.uid());
end $$;
revoke all on function public.delete_my_data() from public;
grant execute on function public.delete_my_data() to authenticated;

-- ------------------------------------------------------------------ no anonymous access to anything
revoke all on all tables in schema public from anon;
