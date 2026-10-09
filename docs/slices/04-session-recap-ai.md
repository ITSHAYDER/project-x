# Slice 4: the clinician's one-minute payoff (paste this alone)

Read `docs/HANDOFF_PROMPT.md` sections 1 to 3. The AI invariants are strict: AI never computes, never sees raw journal text or private data, output is verified or discarded, product works with AI off.

Build "Session Recap with AI drafting" behind a flag (default off). After a session the clinician types 30 to 60 seconds. The system PROPOSES: (a) Map additions, (b) focus items with linked signals (only signals the patient shares), (c) a plain-language take-home for the patient, (d) carry-over agenda. Nothing is saved or sent until the clinician confirms each part. Extend `lib/domain/ai/verifier.ts` for proposals (only content present in the clinician's text; no diagnoses, advice, medication or predictions). Do not store the clinician's raw text unless they choose to.

Tests (mocked provider): unsafe output rejected, invented signal ids rejected, prompt-injection text inside the clinician note has no effect, provider errors map to the typed errors already in `lib/ai/provider.ts`.

Done when: end-to-end works with the flag on and with AI off the manual recap form still works.
