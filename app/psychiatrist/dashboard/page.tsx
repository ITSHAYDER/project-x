import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActivePatients } from "@/lib/services/relationships";
import { createInviteAction } from "@/app/psychiatrist/actions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PatientRoster } from "@/components/psychiatrist/PatientRoster";

const PSYCH_LINKS = [{ href: "/psychiatrist/dashboard", label: "Patients" }];
type RecentCheckIn = {
  patient_id: string | null;
  checkin_date: string;
  mood: number | null;
  energy: number | null;
  wants_to_discuss: boolean;
};

export default async function PsychiatristDashboard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite_token?: string }>;
}) {
  const { error, invite_token } = await searchParams;
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

  const patients = await getActivePatients(user.id);
  const patientIds = patients.map((patient) => patient.patient_id).filter(Boolean) as string[];
  const { data: recentCheckIns } = patientIds.length
    ? await supabase
        .from("check_ins")
        .select("patient_id, checkin_date, mood, energy, wants_to_discuss")
        .in("patient_id", patientIds)
        .order("checkin_date", { ascending: false })
    : { data: [] as RecentCheckIn[] };
  const { data: visitRequests } = patientIds.length
    ? await supabase
        .from("discussion_items")
        .select("id, patient_id, title, description, created_at")
        .in("patient_id", patientIds)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] };
  const latestByPatient = new Map<string, RecentCheckIn>();
  for (const checkIn of recentCheckIns ?? []) {
    if (checkIn.patient_id && !latestByPatient.has(checkIn.patient_id)) {
      latestByPatient.set(checkIn.patient_id, checkIn);
    }
  }
  const inviteUrl = invite_token ? `/invite/${invite_token}` : null;

  return (
    <AppShell displayName={`Dr. ${profile.display_name}`} links={PSYCH_LINKS}>
      <div className="flex flex-col gap-6">
        <header className="hero-surface flex flex-col gap-3 rounded-xl p-6 text-white sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/65">Practice workspace</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div><h1 className="text-4xl text-white sm:text-5xl">A clearer start to the visit.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-white/65">Review what patients have chosen to share, then open the original context when you need it.</p></div>
            <p className="text-sm text-white/55">{patients.length} {patients.length === 1 ? "patient" : "patients"}</p>
          </div>
        </header>

        <div className="flex items-center justify-between gap-4 border-b border-hairline pb-4">
          <div>
            <p className="eyebrow">Your care list</p>
            <p className="mt-1 text-sm text-ink/60">The latest patient-reported context appears here. Nothing is inferred.</p>
          </div>
          <form action={createInviteAction}>
            <Button type="submit" variant="secondary" className="shrink-0">
              Invite patient <span className="ml-2">+</span>
            </Button>
          </form>
        </div>

        {error && (
          <p className="rounded-2xl border border-clay/20 bg-clay-soft px-3.5 py-2.5 text-sm text-clay">
            {error}
          </p>
        )}

        {inviteUrl && (
          <div className="soft-panel flex flex-col gap-2 p-4 sm:p-5">
            <p className="text-sm font-medium text-ink">Share this link with your patient</p>
            <p className="text-xs leading-5 text-ink/60">
              It works once, for the person who opens it. Send it directly rather than posting it publicly.
            </p>
            <code className="mt-1 break-all rounded-xl border border-hairline bg-white px-3 py-2 text-sm text-pine-dark">
              {process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}
              {inviteUrl}
            </code>
          </div>
        )}

        <section id="visit-requests" className="scroll-mt-28 border-b border-hairline pb-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Patient-authored agenda</p>
              <h2 className="mt-1 text-xl text-ink">Topics patients want to discuss</h2>
            </div>
            <span className="text-xs tabular-nums text-ink/50">{visitRequests?.length ?? 0} open</span>
          </div>
          {!visitRequests?.length ? (
            <p className="mt-3 text-sm text-ink/55">No open topics from connected patients.</p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {visitRequests.map((request) => {
                const patient = patients.find((item) => item.patient_id === request.patient_id);
                const name = (patient?.profiles as unknown as { display_name: string } | null)?.display_name ?? "Patient";
                return (
                  <a
                    key={request.id}
                    href={`/psychiatrist/patients/${request.patient_id}`}
                    className="rounded-lg border border-hairline bg-white/65 px-4 py-3 transition-colors hover:border-clay/40 hover:bg-clay-soft/30"
                  >
                    <span className="block text-xs font-medium text-clay">{name}</span>
                    <span className="mt-1 block text-sm font-medium text-ink">{request.title}</span>
                    {request.description && <span className="mt-1 line-clamp-2 block text-xs leading-5 text-ink/60">{request.description}</span>}
                  </a>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-xs text-ink/45">Topics patients chose to add. This list is not triaged for urgency.</p>
        </section>

        {patients.length === 0 ? (
          <EmptyState
            title="Your care list is ready when you are"
            description="Create a private invite link for a patient. They choose what to share, and you can review it here before the next conversation."
          />
        ) : (
          <PatientRoster
            patients={patients.map((patient) => {
              const patientId = patient.patient_id!;
              return {
                id: patientId,
                name:
                  (patient.profiles as unknown as { display_name: string } | null)?.display_name ??
                  "Patient",
                acceptedAt: patient.accepted_at,
                latestCheckIn: latestByPatient.get(patientId),
              };
            })}
          />
        )}
      </div>
    </AppShell>
  );
}
