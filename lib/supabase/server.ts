import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Used inside Server Components and Server Actions. Reads/writes the
// user's own session cookie -- it authenticates AS the logged-in user,
// never as an admin. It never uses the service-role key.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component during render, where cookies
            // can't be set. Harmless as long as middleware.ts (below) is
            // also refreshing the session on every request.
          }
        },
      },
    }
  );
}
