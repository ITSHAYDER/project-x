import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRecentCheckIns } from "@/lib/services/checkins";
import { AppShell } from "@/components/AppShell";
import { Sparkline } from "@/components/ui/Sparkline";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";

const LINKS = [
  { href: "/patient/dashboard", label: "Today" },
  { href: "/patient/assessment", label: "Assessment" },
  { href: "/patient/insights", label: "Insights" },
  { href: "/patient/timeline", label: "Timeline" },
];

function average(values: (number | null)[]) {
  const usable = values.filter((value): value is number => value !== null);
  return usable.length ? (usable.reduce((sum, value) => sum + value, 0) / usable.length).toFixed(1) : "—";
}

export default async function InsightsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("display_name, role").eq("id", user.id).single();
  if (profile?.role !== "patient") redirect("/psychiatrist/dashboard");
  const checkIns = await getRecentCheckIns(user.id, 30);
  const mood = checkIns.map((item) => item.mood);
  const energy = checkIns.map((item) => item.energy);
  const sleep = checkIns.map((item) => item.sleep_hours);
  const hasEnoughData = checkIns.length >= 3;
  const lowSleep = checkIns.filter((item) => item.sleep_hours !== null && item.sleep_hours < 6);
  const lowSleepMood = average(lowSleep.map((item) => item.mood));
  const allMood = average(mood);
  const possibleSleepPattern = lowSleep.length >= 2 && lowSleepMood !== "—" && allMood !== "—" && Number(lowSleepMood) < Number(allMood);

  return (
    <AppShell displayName={profile.display_name} links={LINKS}>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2"><p className="text-xs font-medium uppercase tracking-[0.16em] text-pine-dark/70">Patterns, not diagnoses</p><h1 className="text-3xl text-ink">Your insights</h1><p className="max-w-2xl text-sm leading-6 text-ink/65">These observations come from what you record here. They are possibilities worth observing, not conclusions about your mental health.</p></header>

        {!hasEnoughData ? <EmptyState title="Not enough data yet" description="After a few more check-ins, this space can show possible relationships between sleep, mood, and energy without guessing beyond your records." /> : (
          <>
            <div className="grid gap-4 sm:grid-cols-3"><div className="soft-panel p-4"><p className="text-xs uppercase tracking-[0.12em] text-ink/50">Mood average</p><p className="mt-3 text-2xl font-medium text-ink">{allMood}/5</p><p className="mt-1 text-sm text-ink/60">last 30 days</p></div><div className="soft-panel p-4"><p className="text-xs uppercase tracking-[0.12em] text-ink/50">Energy average</p><p className="mt-3 text-2xl font-medium text-ink">{average(energy)}/5</p><p className="mt-1 text-sm text-ink/60">last 30 days</p></div><div className="soft-panel p-4"><p className="text-xs uppercase tracking-[0.12em] text-ink/50">Sleep average</p><p className="mt-3 text-2xl font-medium text-ink">{average(sleep)}h</p><p className="mt-1 text-sm text-ink/60">last 30 days</p></div></div>
            <section className="soft-panel flex flex-col gap-4 p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><h2 className="text-xl text-ink">Possible relationships</h2><Badge tone="positive">Based on your records</Badge></div>{possibleSleepPattern ? <div className="rounded-xl border border-pine/15 bg-pine-soft/50 p-4"><p className="font-medium text-ink">Sleep and mood may be connected</p><p className="mt-1 text-sm leading-6 text-ink/70">On {lowSleep.length} recorded nights under 6 hours, your average mood was {lowSleepMood}/5 compared with {allMood}/5 overall. This is worth observing, not a diagnosis.</p></div> : <div className="rounded-xl border border-hairline bg-white/35 p-4"><p className="font-medium text-ink">No clear relationship yet</p><p className="mt-1 text-sm leading-6 text-ink/70">Your current records do not show enough consistent evidence for a sleep-and-mood observation. Keep checking in and review this with a professional if it becomes useful.</p></div>}</section>
            <section className="soft-panel flex flex-col gap-3 p-5 sm:p-6"><h2 className="text-xl text-ink">Recorded mood</h2><p className="text-sm text-ink/60">A descriptive view of your own entries, with no smoothing or interpretation.</p><Sparkline values={mood} /></section>
          </>
        )}
      </div>
    </AppShell>
  );
}
