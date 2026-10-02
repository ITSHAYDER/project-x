import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { pauseAssessment, saveAssessmentResponse, startAssessment } from "./actions";

const PATIENT_LINKS = [
  { href: "/patient/dashboard", label: "Today" },
  { href: "/patient/assessment", label: "Assessment" },
  { href: "/patient/insights", label: "Insights" },
  { href: "/patient/timeline", label: "Timeline" },
];

const QUESTIONS = [
  { key: "mood", title: "How has your mood been recently?", hint: "You can describe the overall pattern, not just today.", placeholder: "For example: mostly low, mixed, steady, or changing quickly..." },
  { key: "energy", title: "How has your energy been compared with your usual baseline?", hint: "Think about your typical week, not your best or worst day.", placeholder: "What has felt different, if anything?" },
  { key: "sleep", title: "What has sleep been like lately?", hint: "Include changes in hours, quality, or how rested you feel.", placeholder: "For example: sleeping more, waking often, or needing less sleep..." },
  { key: "anxiety", title: "What has worry or anxiety been like?", hint: "Notice triggers, physical feelings, avoidance, or rumination.", placeholder: "What situations or thoughts tend to bring it on?" },
  { key: "focus", title: "How have focus, motivation, or follow-through been?", hint: "There can be many reasons for concentration changes, including stress, sleep, mood, or attention patterns.", placeholder: "What is easier or harder to start and finish?" },
  { key: "relationships", title: "How have relationships and connection felt?", hint: "You can include loneliness, conflict, reassurance, or withdrawal.", placeholder: "What patterns have you noticed with people close to you?" },
  { key: "changes", title: "Have you noticed any important changes from your usual self?", hint: "Include changes others have noticed, if relevant.", placeholder: "What feels most important to understand?" },
  { key: "safety", title: "Have you had thoughts of hurting yourself or someone else?", hint: "You can skip this, but answering honestly helps us keep this experience safe. This app cannot provide emergency care.", placeholder: "You can answer yes, no, or describe what has been happening." },
];

export default async function AssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; completed?: string }>;
}) {
  const { error, completed } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: assessment }] = await Promise.all([
    supabase.from("profiles").select("display_name, role").eq("id", user.id).single(),
    supabase.from("assessments").select("*").eq("patient_id", user.id).in("status", ["in_progress", "paused", "completed"]).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (profile?.role !== "patient") redirect("/psychiatrist/dashboard");

  const links = PATIENT_LINKS;
  const step = assessment?.current_step ?? 0;
  const question = QUESTIONS[step];
  const { data: response } = assessment && question
    ? await supabase.from("assessment_responses").select("response").eq("assessment_id", assessment.id).eq("question_key", question.key).maybeSingle()
    : { data: null };

  return (
    <AppShell displayName={profile.display_name} links={links}>
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-pine-dark/70">Self-reflection</p>
              <h1 className="mt-2 text-3xl text-ink">A clearer picture of your days</h1>
            </div>
            <Badge tone="positive">Private</Badge>
          </div>
          <p className="max-w-xl text-sm leading-6 text-ink/65">A few thoughtful questions, one at a time. This is not a diagnosis. It is a place to notice patterns you may want to discuss with a professional.</p>
        </header>

        {error && <p className="rounded-2xl border border-clay/20 bg-clay-soft px-3.5 py-2.5 text-sm text-clay">{error}</p>}
        {completed && <p className="rounded-2xl border border-pine/20 bg-pine-soft/70 px-3.5 py-2.5 text-sm text-pine-dark">Your reflection is complete. You can review it with a professional whenever you choose.</p>}

        {!assessment ? (
          <section className="soft-panel flex flex-col gap-5 p-6 sm:p-8">
            <div className="grid gap-3 sm:grid-cols-3">
              <div><p className="text-2xl font-medium text-ink">8</p><p className="text-sm text-ink/60">short prompts</p></div>
              <div><p className="text-2xl font-medium text-ink">1 at a time</p><p className="text-sm text-ink/60">no giant questionnaire</p></div>
              <div><p className="text-2xl font-medium text-ink">Pause anytime</p><p className="text-sm text-ink/60">your progress is saved</p></div>
            </div>
            <form action={startAssessment}><Button type="submit">Begin reflection</Button></form>
          </section>
        ) : step >= QUESTIONS.length || assessment.status === "completed" ? (
          <section className="soft-panel flex flex-col gap-4 p-6 sm:p-8">
            <p className="text-lg font-medium text-ink">You made space to reflect.</p>
            <p className="text-sm leading-6 text-ink/65">Your responses are saved privately. Patterns are not diagnoses, and a qualified professional is the right person to interpret them in context.</p>
            <div className="flex flex-wrap gap-3"><a href="/patient/insights"><Button>View your insights</Button></a><a href="/patient/dashboard"><Button variant="secondary">Back to today</Button></a></div>
          </section>
        ) : (
          <section className="soft-panel flex flex-col gap-6 p-6 sm:p-8">
            <div className="flex items-center justify-between text-xs text-ink/55"><span>Question {step + 1} of {QUESTIONS.length}</span><span>{Math.round(((step + 1) / QUESTIONS.length) * 100)}%</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-hairline"><div className="h-full rounded-full bg-pine transition-all duration-500" style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} /></div>
            <div><h2 className="text-2xl text-ink">{question.title}</h2><p className="mt-2 text-sm leading-6 text-ink/60">{question.hint}</p></div>
            <form action={saveAssessmentResponse} className="flex flex-col gap-4">
              <input type="hidden" name="assessment_id" value={assessment.id} /><input type="hidden" name="question_key" value={question.key} /><input type="hidden" name="step" value={step} />
              <Textarea name="response" rows={6} placeholder={question.placeholder} defaultValue={response?.response === "Skipped" ? "" : response?.response ?? ""} />
              <div className="flex flex-wrap items-center gap-3"><Button type="submit">Save and continue</Button><button type="submit" name="skipped" value="true" className="rounded-full px-4 py-2.5 text-sm text-pine-dark transition-colors hover:bg-pine-soft/60">Skip for now</button></div>
            </form>
            <form action={pauseAssessment}><input type="hidden" name="assessment_id" value={assessment.id} /><button className="self-start text-xs text-ink/50 underline-offset-2 hover:text-ink hover:underline">Pause and come back later</button></form>
          </section>
        )}
      </div>
    </AppShell>
  );
}
