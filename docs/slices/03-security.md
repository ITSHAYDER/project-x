# Slice 3: security and trust (paste this alone, after Slice 2)

Read `docs/HANDOFF_PROMPT.md` sections 1 to 3 and `docs/GO_LIVE_CHECKLIST.md`.

Build: single-use, expiring, hashed, optionally email-bound invitations (accepted in one transaction, rate limited); TOTP MFA required for clinicians before any patient route; email confirmation on; CSP and rate limits on auth, invites, AI and export; log redaction with a test that no entry text appears in logs; ending a care link (clinician access stops immediately, the patient's record stays and keeps working stand-alone); data export and deletion (use `delete_my_data()` from the schema); `ALLOW_REAL_PATIENT_DATA` gate.

Write `docs/SECURITY_REVIEW.md` with the attacks you tried (anonymous, patient vs another patient's ids, unlinked/revoked clinician, expired or reused invite, role self-assignment) and the evidence.

Done when: those attacks fail in automated tests, and every code item in the go-live checklist is done or explicitly listed as remaining.
