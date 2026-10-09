# Two versions, one codebase

You want (1) a **showcase** you can put in front of investors, psychologists and clinics, and (2) the **real product**. Do not fork them. Two repos drift apart within weeks and every improvement has to be made twice.

One codebase, one switch: `APP_MODE`.

| | `APP_MODE=showcase` (default) | `APP_MODE=product` |
|---|---|---|
| Who it is for | Investors, psychologists, clinics, demos | Real users, pilots, production |
| Data | Synthetic personas, in-memory, resettable | Real accounts, saved to a JSON file (MVP); Supabase + RLS next |
| Sign-in | One-click personas (Alex, Sam, Riley, Jordan, Dr. Lee) | Real sign up / log in (MVP, JSON-file storage; Supabase next) |
| Extras | Guided tour (`/tour`), presenter notes ("Look for this"), Reset demo, planted patterns | None of these appear |
| Banner | "Showcase with synthetic data only" | "Synthetic data only" until `ALLOW_REAL_PATIENT_DATA=true` AND product mode |
| Engine, privacy rules, design, screens | Identical | Identical |

Rules that keep them from drifting:
1. **Everything shared lives behind interfaces.** Screens and actions call `lib/auth/demo.ts` and `lib/data/store.ts`. Product work replaces the implementation behind those (Supabase repo, real auth), not the screens.
2. **Showcase-only code is tiny and explicit**: `components/ShowcaseNote.tsx`, `app/tour`, persona sign-in, `resetDemo`. All gated by `lib/config.ts`. If you add showcase-only code, gate it the same way and add a test that product mode hides it (see the PRODUCT MODE checks in the render smoke test).
3. **Every new feature ships with seed data** (`lib/data/seed.ts`) so it can be demonstrated, and with tests so it can be trusted.
4. **Be honest on the showcase.** The tour says what is real, synthetic, unbuilt and unproven. Investors and clinicians trust that more than polish, and it protects you.
5. **Deploy them separately**: showcase on its own URL (e.g. `demo.yourdomain`) with `APP_MODE=showcase`; product on a different project with `APP_MODE=product`, its own database and keys. Never point the showcase at real data.

What to put in the showcase that you would not put in product: the tour, presenter notes, the planted 12-week patient, persona switching.
What to build only in product: real accounts, invitations, MFA, Supabase, audit export, billing, admin.

Suggested order of work: finish Slice 0 and 1 (done in this repo, apart from running `npm install`/`build`), then make the showcase great for the first clinician conversations, then build the product slices in `docs/slices/` one at a time.
