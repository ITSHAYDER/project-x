import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveRelationship } from "@/lib/services/relationships";
import { getRecentCheckIns } from "@/lib/services/checkins";
import { getDiscussionItems } from "@/lib/services/discussionItems";
import { getSharedJournalEntries } from "@/lib/services/journals";
import { generateSummaryAction } from "./actions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { Sparkline } from "@/components/ui/Sparkline";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AISummaryOutput } from "@/lib/validation/schemas";

const PSYCH_LINKS = [{ href: "/psychiatrist/dashboard", label: "Patients" }];

function SummarySection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-pine-dark/70">
        {title}
      </p>
      <ul className="flex flex-col gap-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-ink/80">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function PatientProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id: patientId } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "psychiatrist") redirect("/patient/dashboard");

  const relationship = await getActiveRelationship(patientId, user.id);
  if (!relationship) redirect("/psychiatrist/dashboard");

  const { data: patientProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", patientId)
    .single();

  const [checkIns, discussionItems, sharedEntries, { data: latestSummary }] =
    await Promise.all([
      getRecentCheckIns(patientId, 30),
      getDiscussionItems(patientId),
      getSharedJournalEntries(patientId),
      supabase
        .from("ai_summaries")
        .select("*")
        .eq("patient_id", patientId)
        .eq("generated_for_psychiatrist_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const openItems = discussionItems.filter((d) => d.status === "open");
  const summary = latestSummary?.output as AISummaryOutput | undefined;

  const averageMood = checkIns.length
    ? (checkIns.reduce((sum, item) => sum + (item.mood ?? 0), 0) / checkIns.length).toFixed(1)
    : "—";
  const openDiscussionCount = discussionItems.filter((item) => item.status === "open").length;

  return (
    <AppShell displayName={`Dr. ${profile.display_name}`} links={PSYCH_LINKS}>
      <div className="flex flex-col gap-8">
        <div>
          <a href="/psychiatrist/dashboard" className="text-sm text-ink/50 hover:text-ink">
            ← All patients
          </a>
          <h1 className="mt-2 text-3xl text-ink">
            {patientProfile?.display_name ?? "Patient"}
          </h1>
        </div>

        {error && (
          <p className="rounded-2xl border border-clay/20 bg-clay-soft px-3.5 py-2.5 text-sm text-clay">
            {error}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="soft-panel p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-ink/50">Average mood</p>
            <p className="mt-3 text-2xl font-medium text-ink">{averageMood}</p>
            <p className="mt-1 text-sm text-ink/60">over 30 days</p>
          </div>
          <div className="soft-panel p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-ink/50">Open topics</p>
            <p className="mt-3 text-2xl font-medium text-ink">{openDiscussionCount}</p>
            <p className="mt-1 text-sm text-ink/60">needing attention</p>
          </div>
          <div className="soft-panel p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-ink/50">Shared entries</p>
            <p className="mt-3 text-2xl font-medium text-ink">{sharedEntries.length}</p>
            <p className="mt-1 text-sm text-ink/60">in the last month</p>
          </div>
        </div>

        <section className="soft-panel flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-lg font-medium text-ink">Since your last review</p>
            <form action={generateSummaryAction}>
              <input type="hidden" name="patient_id" value={patientId} />
              <Button type="submit" variant="secondary">
                {summary ? "Create a new summary" : "Create summary"}
              </Button>
            </form>
          </div>
          <p className="text-xs leading-5 text-ink/55">
            This summary is meant to support your thinking, not replace it. Check the raw timeline and notes below before making clinical decisions.
          </p>
          <p className="text-xs leading-5 text-clay">
            Prototype privacy note: generating a summary sends selected check-ins, shared journal entries, and discussion topics to Google Gemini. Use synthetic data only until your organization has reviewed the provider, consent, and privacy requirements.
          </p>

          {summary ? (
            <div className="flex flex-col gap-4 border-t border-pine/20 pt-4">
              <SummarySection title="Major changes" items={summary.major_changes} />
              <SummarySection title="Recurring themes" items={summary.recurring_themes} />
              <SummarySection
                title="Medication experiences (patient-reported)"
                items={summary.medication_experiences}
              />
              <SummarySection
                title="Patient-reported concerns"
                items={summary.patient_reported_concerns}
              />
              <SummarySection title="Discussion topics" items={summary.discussion_topics} />
              <SummarySection
                title="Worth reviewing"
                items={summary.questions_for_review}
              />
              <SummarySection title="Uncertain / insufficient data" items={summary.uncertainties} />
            </div>
          ) : (
            <p className="text-sm leading-6 text-ink/60">
              No summary yet. Create one to pull together the last 30 days of check-ins and shared entries.
            </p>
          )}
        </section>

        <section className="soft-panel p-5 sm:p-6">
          <p className="mb-3 text-sm font-medium text-ink">Mood, last 30 days</p>
          <Sparkline values={checkIns.map((c) => c.mood)} />
        </section>

        <section className="soft-panel p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <p className="text-sm font-medium text-ink">Discussion topics</p>
            {openItems.length > 0 && <Badge tone="attention">{openItems.length} open</Badge>}
          </div>
          {discussionItems.length === 0 ? (
            <EmptyState title="Nothing flagged yet" description="No discussion topics for this patient right now." />
          ) : (
            discussionItems.map((item) => (
              <div key={item.id} className="border-t border-hairline py-3 first:border-t-0 first:pt-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-ink">{item.title}</p>
                  <Badge tone={item.status === "open" ? "attention" : "neutral"}>
                    {item.status}
                  </Badge>
                </div>
                {item.description && (
                  <p className="mt-1 text-sm leading-6 text-ink/70">{item.description}</p>
                )}
              </div>
            ))
          )}
        </section>

        <section className="soft-panel p-5 sm:p-6">
          <p className="mb-3 text-sm font-medium text-ink">Shared journal entries</p>
          {sharedEntries.length === 0 ? (
            <EmptyState
              title="Nothing shared yet"
              description="This patient has not shared any journal entries with you yet."
            />
          ) : (
            sharedEntries.map((entry) => (
              <div key={entry.id} className="border-t border-hairline py-3 first:border-t-0 first:pt-0">
                <p className="text-sm font-medium text-ink">{entry.title || "Untitled"}</p>
                <p className="mb-1 text-xs text-ink/50">
                  {new Date(entry.created_at).toLocaleDateString()}
                </p>
                <p className="text-sm leading-7 text-ink/80">{entry.content}</p>
              </div>
            ))
          )}
        </section>
      </div>
    </AppShell>
  );
}
