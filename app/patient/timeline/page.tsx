import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

const PATIENT_LINKS = [
  { href: "/patient/dashboard", label: "Today" },
  { href: "/patient/assessment", label: "Assessment" },
  { href: "/patient/insights", label: "Insights" },
  { href: "/patient/journal", label: "Journal" },
  { href: "/patient/discussions", label: "To discuss" },
  { href: "/patient/timeline", label: "Timeline" },
];

type TimelineEvent = {
  date: string;
  kind: "check-in" | "journal" | "discussion";
  summary: string;
  detail?: string;
};

export default async function TimelinePage() {
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

  const [{ data: checkIns }, { data: journalEntries }, { data: discussionItems }] =
    await Promise.all([
      supabase
        .from("check_ins")
        .select("checkin_date, mood, energy, note")
        .eq("patient_id", user.id),
      supabase
        .from("journal_entries")
        .select("created_at, title, content")
        .eq("patient_id", user.id),
      supabase
        .from("discussion_items")
        .select("created_at, title, status")
        .eq("patient_id", user.id),
    ]);

  const events: TimelineEvent[] = [
    ...(checkIns ?? []).map((c) => ({
      date: c.checkin_date,
      kind: "check-in" as const,
      summary: `Mood ${c.mood}/5, energy ${c.energy}/5`,
      detail: c.note ?? undefined,
    })),
    ...(journalEntries ?? []).map((j) => ({
      date: j.created_at,
      kind: "journal" as const,
      summary: j.title || "Journal entry",
      detail: j.content,
    })),
    ...(discussionItems ?? []).map((d) => ({
      date: d.created_at,
      kind: "discussion" as const,
      summary: d.title,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <AppShell displayName={profile?.display_name ?? ""} links={PATIENT_LINKS}>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl text-ink">Your timeline</h1>
          <p className="text-sm leading-6 text-ink/65">
            A gentle record of your check-ins, notes, and things worth bringing up.
          </p>
        </div>

        {events.length === 0 ? (
          <EmptyState
            title="Your story is still unfolding"
            description="As you check in, write entries, and note things to discuss, they’ll appear here in one quiet timeline."
          />
        ) : (
          <div>
            {events.map((event, i) => (
              <div key={i} className="flex gap-4 border-t border-hairline py-4 first:border-t-0 first:pt-0">
                <div className="w-24 shrink-0 pt-0.5 text-xs text-ink/50">
                  {new Date(event.date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge
                      tone={
                        event.kind === "discussion"
                          ? "attention"
                          : event.kind === "journal"
                            ? "neutral"
                            : "positive"
                      }
                    >
                      {event.kind === "check-in"
                        ? "Check-in"
                        : event.kind === "journal"
                          ? "Journal"
                          : "To discuss"}
                    </Badge>
                  </div>
                  <p className="text-sm text-ink">{event.summary}</p>
                  {event.detail && (
                    <p className="mt-1 text-sm leading-6 text-ink/60">{event.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
