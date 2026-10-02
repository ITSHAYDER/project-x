import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTodayCheckIn, getRecentCheckIns } from "@/lib/services/checkins";
import { getDiscussionItems } from "@/lib/services/discussionItems";
import { submitCheckIn } from "@/app/patient/checkin/actions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea, Label } from "@/components/ui/Input";
import { ScalePicker } from "@/components/ui/ScalePicker";
import { Sparkline } from "@/components/ui/Sparkline";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";

const PATIENT_LINKS = [
  { href: "/patient/dashboard", label: "Today" },
  { href: "/patient/assessment", label: "Assessment" },
  { href: "/patient/insights", label: "Insights" },
  { href: "/patient/timeline", label: "Timeline" },
  { href: "/patient/journal", label: "Journal" },
  { href: "/patient/discussions", label: "To discuss" },
  { href: "/patient/settings", label: "Privacy" },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function PatientDashboard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
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
  if (profile?.role !== "patient") redirect("/psychiatrist/dashboard");

  const [todayCheckIn, recentCheckIns, discussionItems, { data: assessment }] = await Promise.all([
    getTodayCheckIn(user.id),
    getRecentCheckIns(user.id, 14),
    getDiscussionItems(user.id),
    supabase.from("assessments").select("status, current_step").eq("patient_id", user.id).in("status", ["in_progress", "paused", "completed"]).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const openDiscussionCount = discussionItems.filter((d) => d.status === "open").length;
  const moodValues = recentCheckIns.map((checkIn) => checkIn.mood).filter((value): value is number => value !== null);
  const averageMood = moodValues.length
    ? (moodValues.reduce((sum, value) => sum + value, 0) / moodValues.length).toFixed(1)
    : "—";
  const lastCheckIn = todayCheckIn ?? recentCheckIns[0];

  return (
    <AppShell displayName={profile.display_name} links={PATIENT_LINKS}>
      <div className="flex flex-col gap-6">
        <header className="hero-surface flex flex-col gap-3 rounded-xl p-6 text-white sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/65">
              {greeting()}
            </p>
            <span className="text-xs text-white/55">Your care space</span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="text-4xl text-white sm:text-5xl">
              {profile.display_name.split(" ")[0]}.
            </h1>
            <p className="max-w-xs text-sm leading-6 text-white/65">A small place to remember what matters before it gets lost in the week.</p>
          </div>
        </header>

        {error && (
          <p className="rounded-2xl border border-clay/20 bg-clay-soft px-3.5 py-2.5 text-sm text-clay">
            {error}
          </p>
        )}
        {saved && (
          <p className="animate-gentle-in rounded-2xl border border-pine/20 bg-pine-soft/70 px-3.5 py-2.5 text-sm text-pine-dark">
            Saved for today.
          </p>
        )}

        {todayCheckIn ? (
          <section className="soft-panel flex flex-col gap-4 p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Today is captured</p>
                <h2 className="mt-2 text-2xl text-ink">You&apos;ve made a note of today.</h2>
                <p className="mt-1 text-sm text-ink/60">
                  Mood {todayCheckIn.mood}/5 · Energy {todayCheckIn.energy}/5
                  {todayCheckIn.sleep_hours ? ` · ${todayCheckIn.sleep_hours}h sleep` : ""}
                </p>
              </div>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer list-none text-pine-dark underline-offset-2 hover:underline">
                Update today&apos;s check-in
              </summary>
              <div className="pt-4">
                <CheckInForm defaultValues={todayCheckIn} />
              </div>
            </details>
          </section>
        ) : (
          <section className="soft-panel flex flex-col gap-5 p-6 sm:p-8">
            <div>
              <p className="eyebrow">One minute, for you</p>
              <h2 className="mt-2 text-3xl text-ink">How are you arriving today?</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-ink/60">No right answer. This is your private record, and you can skip anything that does not feel useful.</p>
            </div>
            <CheckInForm />
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="soft-panel flex flex-col gap-3 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div><p className="eyebrow">Your recent rhythm</p><p className="mt-2 text-lg font-medium text-ink">Mood over the last two weeks</p></div>
              <span className="text-2xl font-medium text-pine-dark">{averageMood}</span>
            </div>
            <Sparkline values={recentCheckIns.map((c) => c.mood)} />
          </div>
          <section className="soft-panel flex flex-col justify-between gap-4 bg-[#fff5ed] p-5 sm:p-6">
            <div><p className="eyebrow text-clay">Before your next appointment</p><p className="mt-2 text-lg font-medium text-ink">Keep the important bits close.</p><p className="mt-1 text-sm leading-6 text-ink/60">
              {openDiscussionCount === 0
                ? "Nothing is waiting here yet."
                : `${openDiscussionCount} open ${openDiscussionCount === 1 ? "topic" : "topics"} for your next appointment.`}
            </p></div>
            <Link href="/patient/prepare" className="text-sm font-semibold text-clay hover:underline">{openDiscussionCount > 0 ? "Review your preparation →" : "Start preparing →"}</Link>
          </section>
        </section>

        <section className="flex flex-col gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-medium text-ink">Your other tools</p><p className="text-sm text-ink/55">Reflect, write privately, and review your records when it helps.</p></div>
          <Link href={assessment?.status === "completed" ? "/patient/insights" : assessment ? "/patient/assessment" : "/patient/journal"} className="text-sm font-semibold text-pine-dark hover:underline">{assessment?.status === "completed" ? "View your insights →" : assessment ? "Continue your reflection →" : "Write privately →"}</Link>
        </section>
      </div>
    </AppShell>
  );
}

function CheckInForm({
  defaultValues,
}: {
  defaultValues?: {
    mood: number | null;
    energy: number | null;
    sleep_hours: number | null;
    medication_taken: boolean | null;
    note: string | null;
    wants_to_discuss: boolean;
  };
}) {
  // boolean true -> "yes", boolean false -> "no", null -> "not_applicable".
  // (Written explicitly rather than a boolean comparison trick, which
  // previously mis-selected "N/A" whenever the real value was "No".)
  const medicationDefault =
    defaultValues?.medication_taken === true
      ? "yes"
      : defaultValues?.medication_taken === false
        ? "no"
        : "not_applicable";

  return (
    <form action={submitCheckIn} className="flex flex-col gap-5">
      <fieldset>
        <Label as="legend">Mood</Label>
        <div className="mt-2">
          <ScalePicker name="mood" defaultValue={defaultValues?.mood ?? undefined} />
        </div>
      </fieldset>

      <fieldset>
        <Label as="legend">Energy</Label>
        <div className="mt-2">
          <ScalePicker
            name="energy"
            labels={["🔋", "🔋", "🔋", "🔋", "🔋"]}
            defaultValue={defaultValues?.energy ?? undefined}
          />
        </div>
      </fieldset>

      <Field label="Anything you want to note?" htmlFor="note" hint="Optional">
        <Textarea
          id="note"
          name="note"
          rows={3}
          placeholder="A few words about the day..."
          defaultValue={defaultValues?.note ?? undefined}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sleep" htmlFor="sleep_hours" hint="Last night">
          <Input
            id="sleep_hours"
            name="sleep_hours"
            type="number"
            step="0.5"
            min={0}
            max={24}
            placeholder="7.5"
            defaultValue={defaultValues?.sleep_hours ?? undefined}
          />
        </Field>

        <fieldset>
          <Label as="legend">Medication</Label>
          <div className="mt-1.5 flex gap-2">
            {[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
              { value: "not_applicable", label: "N/A" },
            ].map((opt) => (
              <label
                key={opt.value}
                className="flex flex-1 cursor-pointer items-center justify-center rounded-xl border border-hairline px-2.5 py-2 text-sm transition-colors duration-200 ease-out has-[:checked]:border-pine has-[:checked]:bg-pine-soft"
              >
                <input
                  type="radio"
                  name="medication_taken"
                  value={opt.value}
                  defaultChecked={medicationDefault === opt.value}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink/75">
        <input
          type="checkbox"
          name="wants_to_discuss"
          defaultChecked={defaultValues?.wants_to_discuss}
          className="h-4 w-4 rounded border-hairline accent-pine"
        />
        I want to bring something up at my next appointment
      </label>

      <Button type="submit" className="self-start">
        Save for today
      </Button>
    </form>
  );
}
