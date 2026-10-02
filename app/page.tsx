import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";

const rhythm = [
  ["01", "Check in", "A small daily signal for mood, energy, sleep, and what feels worth naming."],
  ["02", "See the thread", "Your timeline makes changes easier to notice without turning life into a score."],
  ["03", "Bring it forward", "A shared, patient-led record gives the next appointment a better beginning."],
];

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role === "patient") redirect("/patient/dashboard");
    if (profile?.role === "psychiatrist") redirect("/psychiatrist/dashboard");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-paper">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <a href="/" className="flex items-center gap-3 text-night">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-night font-display text-lg text-white">x</span>
          <span className="font-display text-xl">Project X</span>
        </a>
        <div className="flex items-center gap-2 sm:gap-4">
          <a href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-ink/65 hover:bg-white hover:text-ink">Log in</a>
          <a href="/signup"><Button className="px-4 py-2.5">Get started</Button></a>
        </div>
      </nav>

      <section className="border-y border-hairline bg-[#eef2f3]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20 lg:px-12 lg:py-24">
          <div className="max-w-xl">
            <p className="eyebrow text-pine-dark">Continuity, made human</p>
            <h1 className="mt-5 text-5xl leading-[0.98] text-night sm:text-6xl lg:text-7xl">The care between <span className="text-clay">appointments.</span></h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-ink/65">Project X helps people notice what is changing, keep what matters close, and arrive at the next conversation with a clearer story.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="/signup"><Button className="w-full sm:w-auto">Start your rhythm <span className="ml-2">→</span></Button></a>
              <a href="#how-it-works" className="inline-flex items-center justify-center rounded-lg border border-hairline bg-white px-5 py-3 text-sm font-semibold text-ink hover:border-pine/30 hover:bg-pine-soft">See the idea</a>
            </div>
            <p className="mt-6 text-sm text-ink/50">Patient-led. Clinician-supported. Private by default.</p>
          </div>

          <div className="relative lg:pl-8">
            <div className="relative overflow-hidden border border-night/10 bg-night p-5 text-white shadow-[0_30px_70px_rgba(23,32,51,0.2)] sm:p-7">
              <div className="flex items-start justify-between border-b border-white/15 pb-5"><div><p className="text-[10px] uppercase tracking-[0.2em] text-sky">Today, Tuesday</p><p className="mt-2 font-display text-3xl">A little more visible.</p></div><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-sky">1 min</span></div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="bg-white/10 p-4"><p className="text-xs text-white/50">Mood</p><p className="mt-2 text-3xl font-semibold">4 <span className="text-sm font-normal text-white/45">/ 5</span></p><div className="mt-4 h-1 bg-white/15"><div className="h-1 w-4/5 bg-clay" /></div></div><div className="bg-white/10 p-4"><p className="text-xs text-white/50">Energy</p><p className="mt-2 text-3xl font-semibold">3 <span className="text-sm font-normal text-white/45">/ 5</span></p><div className="mt-4 h-1 bg-white/15"><div className="h-1 w-3/5 bg-sky" /></div></div></div>
              <div className="mt-4 border border-white/10 bg-white/5 p-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Worth bringing up</p><span className="text-xs text-clay">Private note</span></div><p className="mt-2 text-sm leading-6 text-white/60">Sleep felt different this week.</p></div>
              <div className="mt-5 flex items-center justify-between text-xs text-white/45"><span>Shared only with your care team</span><span className="text-sky">Saved gently ✓</span></div>
            </div>
            <div className="absolute -bottom-5 -left-3 hidden border border-clay/30 bg-[#fffaf7] p-4 text-night shadow-lg sm:block"><p className="text-[10px] uppercase tracking-[0.18em] text-clay">For the clinician</p><p className="mt-1 font-display text-xl">Arrive informed.</p></div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20"><div><p className="eyebrow">A calmer loop</p><h2 className="mt-4 text-4xl text-night sm:text-5xl">Small moments make better conversations.</h2></div><div className="grid gap-0 border-t border-hairline">{rhythm.map(([number, title, description]) => <article key={number} className="grid gap-4 border-b border-hairline py-6 sm:grid-cols-[64px_190px_1fr] sm:items-start"><span className="font-display text-2xl text-clay">{number}</span><h3 className="text-2xl text-night">{title}</h3><p className="max-w-md text-sm leading-7 text-ink/60">{description}</p></article>)}</div></div>
      </section>

      <section className="border-y border-hairline bg-night text-white"><div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-2 lg:items-end lg:px-12"><div><p className="eyebrow text-sky">Two perspectives, one thread</p><h2 className="mt-4 max-w-xl text-4xl leading-tight sm:text-5xl">Useful for the person living it. Useful for the person supporting them.</h2></div><div className="grid gap-6 border-t border-white/15 pt-6 sm:grid-cols-2 lg:border-t-0 lg:border-l lg:pl-10"><div><p className="font-display text-2xl text-clay">For patients</p><p className="mt-2 text-sm leading-6 text-white/60">A low-pressure place for your own observations, reflections, and questions.</p></div><div><p className="font-display text-2xl text-sky">For psychiatrists</p><p className="mt-2 text-sm leading-6 text-white/60">A focused view of shared context, with original entries always close by.</p></div></div></div></section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-12"><div className="flex flex-col items-start justify-between gap-7 border-b border-hairline pb-16 sm:flex-row sm:items-end"><div><p className="eyebrow">Begin gently</p><h2 className="mt-3 max-w-2xl text-4xl leading-tight text-night sm:text-5xl">Your next useful step can be a small one.</h2></div><a href="/signup" className="inline-flex shrink-0 items-center justify-center rounded-lg bg-clay px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(226,109,90,0.2)] hover:bg-[#cb5e4c]">Create your account <span className="ml-2">→</span></a></div><div className="flex flex-col gap-3 pt-6 text-xs text-ink/50 sm:flex-row sm:items-center sm:justify-between"><span>Project X · Continuity of care between appointments</span><span>Nothing here is a diagnosis. Your care team remains the care team.</span></div></section>
    </main>
  );
}
