# Go-live checklist (nothing here is done)

Do not put real patient data into this prototype until every item is true.

- [ ] Hosting, database and any AI provider covered by appropriate agreements for health data (e.g. BAAs where HIPAA applies; equivalent under GDPR/local law). Confirm the AI provider's data-use and retention terms for your plan and region.
- [ ] Qualified security and privacy review of the schema, RLS, server actions and dependencies.
- [ ] RLS test suite from `docs/RLS_TEST_PLAN.md` passing in CI; authorization tests for every server action.
- [ ] Authentication: Supabase Auth, email confirmation ON, MFA required for clinicians, secure invites, rate limiting, session policy.
- [ ] Legal review of consent text, privacy notice and jurisdictional requirements; versioned consent text stored.
- [ ] Clinical safety review of the crisis path (`lib/domain/safety/crisis.ts`, `app/patient/support`): wording, regional resources, false negatives.
- [ ] Clear statement to patients AND clinicians that data is not monitored in real time and is not for emergencies; clinicians agree a review cadence with patients.
- [ ] Data lifecycle: export, deletion, retention, backups and restore test; understand discovery/subpoena exposure; keep briefs and recaps ephemeral unless a clinician saves them.
- [ ] Incident response and breach-notification procedure.
- [ ] Logging reviewed: no entry text, prompts or AI outputs in any log.
- [ ] Voice capture (not built) only after a provider arrangement suitable for sensitive audio.
- [ ] Clinician interviews and a small pilot completed; decide what to cut based on evidence.
