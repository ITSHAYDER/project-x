import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwnJournalEntries } from "@/lib/services/journals";
import { submitJournalEntry } from "./actions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

const PATIENT_LINKS = [
  { href: "/patient/dashboard", label: "Today" },
  { href: "/patient/assessment", label: "Assessment" },
  { href: "/patient/insights", label: "Insights" },
  { href: "/patient/timeline", label: "Timeline" },
  { href: "/patient/journal", label: "Journal" },
  { href: "/patient/discussions", label: "To discuss" },
];

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const entries = await getOwnJournalEntries(user.id);

  return (
    <AppShell displayName={profile?.display_name ?? ""} links={PATIENT_LINKS}>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl text-ink">Journal</h1>
          <p className="text-sm leading-6 text-ink/65">
            A quiet place to catch what&apos;s been on your mind.
          </p>
        </div>

        {error && (
          <p className="rounded-2xl border border-clay/20 bg-clay-soft px-3.5 py-2.5 text-sm text-clay">
            {error}
          </p>
        )}

        <details className="group">
          <summary className="soft-panel flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-pine-dark">
            <span>Write a new entry</span>
            <span className="text-base text-pine-dark/70">+</span>
          </summary>
          <form action={submitJournalEntry} className="mt-4 flex flex-col gap-4 rounded-2xl border border-hairline bg-white/35 p-4 sm:p-5">
            <Field label="Title (optional)" htmlFor="title">
              <Input id="title" name="title" placeholder="A little heading" />
            </Field>
            <Field label="What&apos;s on your mind?" htmlFor="content">
              <Textarea id="content" name="content" rows={6} required placeholder="Start wherever feels easiest..." />
            </Field>
            <label className="flex items-start gap-2 text-sm text-ink/75">
              <input
                type="checkbox"
                name="is_shared_with_psychiatrist"
                className="mt-0.5 h-4 w-4 rounded border-hairline accent-pine"
              />
              <span>
                Share this entry with my psychiatrist
                <span className="mt-1 block text-xs text-ink/50">
                  Off by default. Entries stay private unless you choose to share them.
                </span>
              </span>
            </label>
            <Button type="submit" className="self-start">
              Save entry
            </Button>
          </form>
        </details>

        <div className="flex flex-col gap-4">
          {entries.length === 0 ? (
            <EmptyState
              title="A quiet place to start"
              description="Write down whatever feels important today. Your entries stay private unless you choose to share them."
            />
          ) : (
            entries.map((entry) => (
              <article key={entry.id} className="soft-panel px-4 py-4 sm:px-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="font-medium text-ink">{entry.title || "Untitled"}</p>
                  {entry.is_shared_with_psychiatrist ? (
                    <Badge tone="positive">Shared</Badge>
                  ) : (
                    <Badge>Private</Badge>
                  )}
                </div>
                <p className="mb-3 text-xs text-ink/50">
                  {new Date(entry.created_at).toLocaleString()}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-7 text-ink/80">{entry.content}</p>
              </article>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
