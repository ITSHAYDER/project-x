import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";

export default async function SafetyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("display_name, role").eq("id", user.id).single();
  if (profile?.role !== "patient") redirect("/psychiatrist/dashboard");

  return (
    <AppShell displayName={profile.display_name} links={[{ href: "/patient/dashboard", label: "Today" }, { href: "/patient/assessment", label: "Assessment" }, { href: "/patient/insights", label: "Insights" }, { href: "/patient/timeline", label: "Timeline" }]}>
      <main className="mx-auto max-w-2xl">
        <section className="soft-panel flex flex-col gap-5 border-clay/30 bg-clay-soft/50 p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-clay">Pause here</p>
          <h1 className="text-3xl text-ink">You do not have to handle this alone.</h1>
          <p className="text-base leading-7 text-ink/75">This app cannot provide emergency care. If you may hurt yourself or someone else, or you are in immediate danger, call your local emergency number now or go to the nearest emergency department.</p>
          <div className="flex flex-col gap-3 text-sm leading-6 text-ink/75">
            <p>Stay with someone you trust, or contact a trusted person and tell them clearly that you need them nearby.</p>
            <p>If you are not in immediate danger, contact a licensed mental-health professional or a local crisis service as soon as you can.</p>
          </div>
          <div className="flex flex-wrap gap-3"><a href="/patient/dashboard"><Button>Return to safety</Button></a><a href="/patient/assessment"><Button variant="secondary">Back to assessment</Button></a></div>
        </section>
      </main>
    </AppShell>
  );
}
