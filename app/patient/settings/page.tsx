import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("display_name, role").eq("id", user.id).single();
  if (profile?.role !== "patient") redirect("/psychiatrist/dashboard");

  return (
    <AppShell displayName={profile.display_name} links={[{ href: "/patient/dashboard", label: "Today" }, { href: "/patient/assessment", label: "Assessment" }, { href: "/patient/insights", label: "Insights" }, { href: "/patient/timeline", label: "Timeline" }]}>
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <header><p className="text-xs font-medium uppercase tracking-[0.16em] text-pine-dark/70">Your control</p><h1 className="mt-2 text-3xl text-ink">Privacy & data</h1><p className="mt-2 text-sm leading-6 text-ink/65">Your reflections belong to you. Sharing with a psychiatrist is opt-in, and private journal entries are not visible to them.</p></header>
        <section className="soft-panel flex flex-col gap-4 p-5 sm:p-6"><h2 className="text-xl text-ink">What Project X stores</h2><ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-ink/70"><li>Check-ins, notes, journal entries, and discussion topics you create.</li><li>Assessment responses you choose to answer or skip.</li><li>Only the journal entries you explicitly share are shown to a connected psychiatrist.</li><li>AI summaries are generated server-side from the minimum relevant information and are framed as self-reported observations.</li></ul></section>
        <section className="soft-panel flex flex-col gap-4 p-5 sm:p-6"><h2 className="text-xl text-ink">Take your data with you</h2><p className="text-sm leading-6 text-ink/65">Download a JSON copy of your records for your own archive or to review with a professional.</p><a href="/api/patient/export"><Button variant="secondary">Export my data</Button></a></section>
        <section className="soft-panel flex flex-col gap-4 border-clay/20 p-5 sm:p-6"><h2 className="text-xl text-ink">Before a real-world pilot</h2><p className="text-sm leading-6 text-ink/65">This beta is designed for synthetic or test data. A qualified privacy and security review is required before collecting real patient information.</p></section>
      </div>
    </AppShell>
  );
}
