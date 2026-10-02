-- Project X — Migration 0003: allow scoped inserts into ai_summaries
-- and audit_logs from authenticated app code.
-- Run this in the SQL Editor AFTER 0001 and 0002.
--
-- Migration 0001 deliberately left these two tables with NO insert
-- policy, on the assumption that only a service-role key would write to
-- them. In practice, the AI summary pipeline (lib/ai/summarize.ts) runs
-- as the logged-in psychiatrist via the normal anon-key + user-session
-- client -- not the service-role key, which should never be used in
-- request-handling code reachable from the browser. So instead of
-- reaching for that key, we grant a narrow, specific insert policy:
-- a psychiatrist may only insert a summary row naming THEMSELVES as
-- generated_for_psychiatrist_id, and only for a patient they currently
-- have an active relationship with.

create policy "psychiatrists can insert summaries for active patients"
  on public.ai_summaries for insert
  with check (
    generated_for_psychiatrist_id = auth.uid()
    and exists (
      select 1 from public.patient_psychiatrist_relationships r
      where r.patient_id = ai_summaries.patient_id
        and r.psychiatrist_id = auth.uid()
        and r.status = 'active'
    )
  );

-- Audit logs: any authenticated user may insert a row, but ONLY naming
-- themselves as the actor -- never forging another user's actions.
-- Still no select policy for any client role, so patients/psychiatrists
-- cannot read the audit log through the app (by design, for now).
create policy "authenticated users can log their own actions"
  on public.audit_logs for insert
  with check (actor_id = auth.uid());
