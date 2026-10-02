import { createClient } from "@/lib/supabase/server";
import { checkInSchema } from "@/lib/validation/schemas";

export async function saveTodayCheckIn(formData: FormData) {
  const parsed = checkInSchema.safeParse({
    mood: formData.get("mood"),
    energy: formData.get("energy"),
    sleep_hours: formData.get("sleep_hours") || undefined,
    medication_taken: formData.get("medication_taken") || undefined,
    note: formData.get("note") || undefined,
    wants_to_discuss: formData.get("wants_to_discuss") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid check-in." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { mood, energy, sleep_hours, medication_taken, note, wants_to_discuss } =
    parsed.data;

  // upsert on (patient_id, checkin_date) -- resubmitting today just
  // updates today's row instead of erroring or duplicating (the unique
  // constraint from migration 0001 is what makes this safe).
  const { error } = await supabase.from("check_ins").upsert(
    {
      patient_id: user.id,
      checkin_date: new Date().toISOString().slice(0, 10),
      mood,
      energy,
      sleep_hours: sleep_hours ?? null,
      medication_taken:
        medication_taken === "yes"
          ? true
          : medication_taken === "no"
            ? false
            : null,
      note: note || null,
      wants_to_discuss: wants_to_discuss ?? false,
    },
    { onConflict: "patient_id,checkin_date" }
  );

  if (error) return { error: "Could not save your check-in. Please try again." };
  return { success: true };
}

export async function getTodayCheckIn(patientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("check_ins")
    .select("*")
    .eq("patient_id", patientId)
    .eq("checkin_date", new Date().toISOString().slice(0, 10))
    .maybeSingle();
  return data;
}

export async function getRecentCheckIns(patientId: string, days = 14) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("check_ins")
    .select("*")
    .eq("patient_id", patientId)
    .order("checkin_date", { ascending: true })
    .limit(days);
  return data ?? [];
}
