import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInviteByToken } from "@/lib/services/relationships";
import { acceptInviteAction } from "./actions";
import { Button } from "@/components/ui/Button";

export default async function AcceptInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Send them to sign up first, then bounce back to this exact invite.
    // This route lives OUTSIDE /patient on purpose -- middleware.ts
    // blocks unauthenticated requests to /patient/*, which would have
    // intercepted a brand-new patient before this page's own redirect
    // ever ran, silently losing the invite token.
    redirect(`/signup?next=/invite/${token}`);
  }

  const invite = await getInviteByToken(token);

  if (!invite) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6 text-center">
        <p className="text-ink">This invite link isn&apos;t valid.</p>
        <p className="text-sm text-ink/60">
          Ask your psychiatrist for a new link, or check that you copied the whole URL.
        </p>
      </main>
    );
  }

  if (invite.status === "active") {
    redirect("/patient/dashboard");
  }

  const psychiatristName =
    (invite.profiles as unknown as { display_name: string } | null)?.display_name ??
    "Your psychiatrist";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 text-center">
      <h1 className="font-display text-2xl font-medium text-ink">
        {psychiatristName} invited you to Project X
      </h1>
      <p className="text-sm text-ink/60">
        Accepting will let {psychiatristName} see your check-ins and any journal
        entries or discussion topics you choose to share. You can revoke this at
        any time.
      </p>

      {error && (
        <p className="rounded-md bg-clay-soft px-3 py-2 text-sm text-clay">{error}</p>
      )}

      <form action={acceptInviteAction}>
        <input type="hidden" name="token" value={token} />
        <Button type="submit" className="w-full">
          Accept invitation
        </Button>
      </form>
    </main>
  );
}
