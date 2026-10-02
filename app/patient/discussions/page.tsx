import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDiscussionItems } from "@/lib/services/discussionItems";
import { submitDiscussionItem, markResolved } from "./actions";
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

export default async function DiscussionsPage({
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

  const items = await getDiscussionItems(user.id);
  const open = items.filter((i) => i.status === "open");
  const resolved = items.filter((i) => i.status === "resolved");

  return (
    <AppShell displayName={profile?.display_name ?? ""} links={PATIENT_LINKS}>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl text-ink">Things worth bringing up</h1>
          <p className="text-sm leading-6 text-ink/65">
            A small list for the moments you don&apos;t want to forget.
          </p>
        </div>

        {error && (
          <p className="rounded-2xl border border-clay/20 bg-clay-soft px-3.5 py-2.5 text-sm text-clay">
            {error}
          </p>
        )}

        <details>
          <summary className="soft-panel flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-pine-dark">
            <span>Add a note</span>
            <span className="text-base text-pine-dark/70">+</span>
          </summary>
          <form action={submitDiscussionItem} className="mt-4 flex flex-col gap-4 rounded-2xl border border-hairline bg-white/35 p-4 sm:p-5">
            <Field label="Title" htmlFor="title">
              <Input id="title" name="title" required placeholder="e.g. New side effect" />
            </Field>
            <Field label="Details (optional)" htmlFor="description">
              <Textarea id="description" name="description" rows={3} placeholder="A little context if it helps." />
            </Field>
            <Button type="submit" className="self-start">
              Add note
            </Button>
          </form>
        </details>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-ink">Open</p>
          {open.length === 0 ? (
            <EmptyState
              title="Nothing on your list yet"
              description="When something feels important, add it here so it&apos;s ready for your next appointment."
            />
          ) : (
            open.map((item) => (
              <div
                key={item.id}
                className="soft-panel flex items-start justify-between gap-4 px-4 py-4"
              >
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <p className="font-medium text-ink">{item.title}</p>
                    <Badge tone="attention">Open</Badge>
                  </div>
                  {item.description && (
                    <p className="text-sm leading-6 text-ink/70">{item.description}</p>
                  )}
                </div>
                <form action={markResolved}>
                  <input type="hidden" name="id" value={item.id} />
                  <button className="whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm text-pine-dark transition-colors duration-200 ease-out hover:bg-pine-soft/60">
                    Mark resolved
                  </button>
                </form>
              </div>
            ))
          )}
        </div>

        {resolved.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-ink/60">Resolved</p>
            {resolved.map((item) => (
              <div key={item.id} className="soft-panel border-dashed px-4 py-3 opacity-70">
                <p className="font-medium text-ink line-through">{item.title}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
