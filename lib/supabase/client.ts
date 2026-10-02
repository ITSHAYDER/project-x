import { createBrowserClient } from "@supabase/ssr";

// Used only inside Client Components ("use client"). Safe to expose the
// anon key here because every table has RLS enabled (see migration 0001) --
// this key can only ever do what a policy explicitly allows.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
