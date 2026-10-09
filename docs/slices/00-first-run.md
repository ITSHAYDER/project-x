# Slice 0: make it run (paste this alone)

Project: `Project X: Playbook` (Next.js 14, TypeScript, Tailwind). Read `docs/HANDOFF_PROMPT.md` sections 1 to 3 first (what it is, inventory, invariants). Do not change behavior.

Task: run `npm install`, `npm run typecheck`, `npm test`, `npm run build`, `npm run dev` and fix whatever breaks (small TypeScript/Next issues are expected: `.ts` import extensions, server actions, React types). Then add a Playwright smoke test that signs in as each persona (Alex, Sam, Riley, Jordan, Dr. Lee) from the home page and opens every screen, failing on console errors. Add axe checks to it.

Done when: build succeeds; `npm test` green (60 tests); the Playwright smoke test passes for all personas; no console errors; a short `docs/PROGRESS.md` entry lists what you fixed. Do not start anything else.
