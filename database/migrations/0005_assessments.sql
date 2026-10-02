-- Project X - Migration 0005: resumable self-reflection assessments
-- Run after 0004_readable_psychiatrist_profiles.sql.
-- This stores user responses only; it does not create diagnoses.

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'paused')),
  current_step integer not null default 0 check (current_step >= 0 and current_step <= 20),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.assessment_responses (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  patient_id uuid not null references public.profiles(id) on delete cascade,
  question_key text not null,
  response text not null check (char_length(response) <= 4000),
  skipped boolean not null default false,
  created_at timestamptz not null default now(),
  unique (assessment_id, question_key)
);

alter table public.assessments enable row level security;
alter table public.assessment_responses enable row level security;

create index assessments_patient_updated_idx on public.assessments (patient_id, updated_at desc);
create unique index assessments_one_open_per_patient_idx on public.assessments (patient_id) where status in ('in_progress', 'paused');
create index assessment_responses_assessment_idx on public.assessment_responses (assessment_id, created_at);

create policy "patients manage their own assessments"
  on public.assessments for all
  using (auth.uid() = patient_id)
  with check (auth.uid() = patient_id);

create policy "patients manage their own assessment responses"
  on public.assessment_responses for all
  using (auth.uid() = patient_id)
  with check (
    auth.uid() = patient_id
    and exists (
      select 1 from public.assessments a
      where a.id = assessment_id and a.patient_id = auth.uid()
    )
  );

create policy "psychiatrists read active patient assessments"
  on public.assessments for select
  using (
    exists (
      select 1 from public.patient_psychiatrist_relationships r
      where r.patient_id = assessments.patient_id
        and r.psychiatrist_id = auth.uid()
        and r.status = 'active'
    )
  );

create policy "psychiatrists read active patient assessment responses"
  on public.assessment_responses for select
  using (
    exists (
      select 1 from public.patient_psychiatrist_relationships r
      where r.patient_id = assessment_responses.patient_id
        and r.psychiatrist_id = auth.uid()
        and r.status = 'active'
    )
  );
