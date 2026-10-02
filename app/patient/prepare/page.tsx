import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getRecentCheckIns } from "@/lib/services/checkins";
import { getDiscussionItems } from "@/lib/services/discussionItems";
import { getOwnJournalEntries } from "@/lib/services/journals";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PrintBriefButton } from "@/components/patient/PrintBriefButton";

const PATIENT_LINKS = [
  { href: "/patient/dashboard", label: "Today" },
  { href: "/patient/prepare", label: "Prepare" },
  { href: "/patient/timeline", label: "Timeline" },
];

export default async function PreparePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "patient") redirect("/psychiatrist/dashboard");

  const [checkIns, discussionItems, journalEntries] = await Promise.all([
    getRecentCheckIns(user.id, 14),
    getDiscussionItems(user.id),
    getOwnJournalEntries(user.id),
  ]);

  const openItems = discussionItems.filter((item) => item.status === "open");
  const sharedEntries = journalEntries.filter((entry) => entry.is_shared_with_psychiatrist);
  const recentCheckIns = checkIns.slice(-7).reverse();
  const hasContext = openItems.length > 0 || sharedEntries.length > 0 || recentCheckIns.length > 0;

  return (
    <AppShell displayName={profile.display_name} links={PATIENT_LINKS}>
      <div className="print-visit-brief flex flex-col gap-6">
        <header className="hero-surface flex flex-col gap-3 rounded-xl p-6 text-white sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/65">Before the next conversation</p>
          <h1 className="text-4xl text-white sm:text-5xl">Bring the useful parts with you.</h1>
          <p className="max-w-2xl text-sm leading-6 text-white/65">This is a private review of what you have recorded. Nothing is sent from this page, and private journal entries stay private.</p>
          <PrintBriefButton />
        </header>

        {!hasContext ? (
          <EmptyState
            title="Your preparation space is quiet for now"
            description="Check in, add something to discuss, or choose to share a journal entry. They will collect here when you need them."
            action={<Link href="/patient/dashboard" className="text-sm font-semibold text-pine-dark hover:underline">Make today&apos;s check-in →</Link>}
          />
        ) : (
          <>
            <section className="soft-panel p-5 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4"><div><p className="eyebrow text-clay">Your agenda</p><h2 className="mt-2 text-2xl text-ink">Things worth bringing up</h2></div><Badge tone="attention">{openItems.length} open</Badge></div>
              {openItems.length === 0 ? <p className="text-sm leading-6 text-ink/60">Nothing is on your discussion list yet. You can add a note when something feels important.</p> : <div className="grid gap-3">{openItems.map((item) => <div key={item.id} className="border-l-2 border-clay/60 bg-[#fff5ed] px-4 py-3"><p className="font-medium text-ink">{item.title}</p>{item.description && <p className="mt-1 text-sm leading-6 text-ink/65">{item.description}</p>}</div>)}</div>}
              <Link href="/patient/discussions" className="mt-5 inline-block text-sm font-semibold text-clay hover:underline">Edit discussion list →</Link>
            </section>

            <section className="soft-panel p-5 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4"><div><p className="eyebrow">Recent signals</p><h2 className="mt-2 text-2xl text-ink">What you have noticed</h2></div><span className="text-xs text-ink/50">Last 7 entries</span></div>
              {recentCheckIns.length === 0 ? <p className="text-sm text-ink/60">No check-ins yet.</p> : <div className="grid gap-2 sm:grid-cols-2">{recentCheckIns.map((item) => <div key={item.id} className="flex items-center justify-between border-b border-hairline py-3 text-sm"><span className="text-ink/60">{new Date(item.checkin_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span><span className="font-medium text-ink">Mood {item.mood ?? "—"}/5 <span className="font-normal text-ink/50">· Energy {item.energy ?? "—"}/5</span></span></div>)}</div>}
            </section>

            <section className="soft-panel p-5 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4"><div><p className="eyebrow text-pine-dark">Shared by you</p><h2 className="mt-2 text-2xl text-ink">Journal context</h2></div><Badge tone="positive">{sharedEntries.length} shared</Badge></div>
              {sharedEntries.length === 0 ? <p className="text-sm leading-6 text-ink/60">You have not shared journal entries with your psychiatrist. Private entries are intentionally not shown here.</p> : <div className="grid gap-4">{sharedEntries.slice(0, 3).map((entry) => <article key={entry.id} className="border-t border-hairline pt-3 first:border-t-0 first:pt-0"><p className="font-medium text-ink">{entry.title || "Untitled"}</p><p className="mt-1 text-xs text-ink/50">{new Date(entry.created_at).toLocaleDateString()}</p><p className="mt-2 line-clamp-3 text-sm leading-6 text-ink/70">{entry.content}</p></article>)}</div>}
              <Link href="/patient/journal" className="mt-5 inline-block text-sm font-semibold text-pine-dark hover:underline">Review your journal →</Link>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
